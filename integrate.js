/*
 * Copyright 2020 Romain Berger <romain.berger58@gmail.com>
 * Copyright 2018 Bors, Ltd <opensource@bors-ltd.fr>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  // Create media player component
  const player = Nuvola.$object(Nuvola.MediaPlayer)
  const volumeHandleRegex = /(\d+)px/

  // Handy aliases
  const PlaybackState = Nuvola.PlaybackState
  const PlayerAction = Nuvola.PlayerAction

  // Create new WebApp prototype
  const WebApp = Nuvola.$WebApp()

  // Initialization routines
  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    const state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  // Page is ready for magic
  WebApp._onPageReady = function () {
    // Actions
    player.setCanRate(false) // No rating on Qobuz

    // Connect handler for signal ActionActivated
    Nuvola.actions.connect('ActionActivated', this)

    // Start update routine
    this.update()
  }

  WebApp._getTrack = function (bottomPlayerContainer) {
    const track = {}

    try {
      const currentAlbumData = bottomPlayerContainer.querySelectorAll('div.player__track-album > a')

      track.title = bottomPlayerContainer.querySelector('div.player__track-overflow').textContent
      track.artist = currentAlbumData[0].textContent
      track.album = currentAlbumData[1].textContent
      track.artLocation = bottomPlayerContainer.querySelector('div.player__track-cover > img').src
      track.length = bottomPlayerContainer.querySelector('span.player__track-time-text:last-child').textContent
      // I could also report the current playlist but it's not (yet?) part of the Nuvola API
    } catch (e) {
      Nuvola.log(`Error in building track info: ${e}`)
    }

    // Return empty track data on error, to reset Nuvola display
    return track
  }

  WebApp._getTrackPosition = function (bottomPlayerContainer) {
    return bottomPlayerContainer.querySelector('span.player__track-time-text:first-child').textContent
  }

  WebApp._getVolume = function (bottomPlayerContainer) {
    const volumeHandle = bottomPlayerContainer.querySelector('div.player__settings-volume-slider div.rangeslider__fill')
    // The slider fill is hard-coded to be positioned at 95px on 100% volume
    const match = volumeHandleRegex.exec(volumeHandle.style.width)
    if (match && match.length) {
      return parseInt(match[1], 10) / 95
    }

    return 1.0
  }

  WebApp._getShuffle = function (playerControl) {
    try {
      return playerControl.querySelector('span.player__action-shuffle').className.includes('active')
    } catch (e) {
      Nuvola.log(`Error in reading shuffle status: ${e}`)
      return null
    }
  }

  WebApp._getRepeat = function (playerControl) {
    try {
      let repeat = Nuvola.PlayerRepeat.NONE
      if (playerControl.querySelector('span.player__action-repeat--active') !== null) {
        if (playerControl.querySelector('span.pct-repeat-once') !== null) {
          repeat = Nuvola.PlayerRepeat.TRACK
        } else {
          repeat = Nuvola.PlayerRepeat.PLAYLIST
        }
      }
      return repeat
    } catch (e) {
      Nuvola.log(`Error in reading repeat status: ${e}`)
      return null
    }
  }

  WebApp._setRepeat = function (repeat, playerControl) {
    const repeatControl = playerControl.querySelector('span.pct-repeat, span.pct-repeat-once')
    while (this._getRepeat(playerControl) !== repeat) {
      Nuvola.clickOnElement(repeatControl)
    }
  }

  WebApp._getCanGoNext = function (playerAction) {
    try {
      return !playerAction.querySelector('span.pct-player-next').classList.contains('disable')
    } catch (e) {
      return false
    }
  }

  WebApp._getCanPlay = function (playerAction) {
    try {
      return !!playerAction.querySelector('span.pct-player-play') // exists
    } catch (e) {
      return false
    }
  }

  WebApp._getCanPause = function (playerAction) {
    try {
      return !!playerAction.querySelector('span.pct-player-pause') // exists
    } catch (e) {
      return false
    }
  }

  // Extract data from the web page
  WebApp.update = function () {
    try {
      // Wait for the bottom banner to be fully loaded on Qobuz bootstrap
      const bottomPlayerContainer = document.querySelector('div#bottomPlayerContainer')

      // Update track information (always)
      player.setTrack(this._getTrack(bottomPlayerContainer))

      // Update track position
      try {
        player.setTrackPosition(this._getTrackPosition(bottomPlayerContainer))
      } catch (e) {
        Nuvola.log(`Error in setting track position: ${e}`)
      }

      // Update volume level
      try {
        player.updateVolume(this._getVolume(bottomPlayerContainer))
      } catch (e) {
        Nuvola.log(`Error in updating volume level: ${e}`)
      }

      const appPlayerAction = bottomPlayerContainer.querySelector('div.player__action')

      // Update shuffle status
      try {
        const shuffle = this._getShuffle(appPlayerAction)
        Nuvola.actions.updateEnabledFlag(PlayerAction.SHUFFLE, shuffle !== null)
        Nuvola.actions.updateState(PlayerAction.SHUFFLE, shuffle)
      } catch (e) {
        Nuvola.log(`Error in updating shuffle: ${e}`)
      }

      // Update repeat status
      try {
        const repeat = this._getRepeat(appPlayerAction)
        Nuvola.actions.updateEnabledFlag(PlayerAction.REPEAT, repeat !== null)
        Nuvola.actions.updateState(PlayerAction.REPEAT, repeat)
      } catch (e) {
        Nuvola.log(`Error in updating repeat: ${e}`)
      }

      // Update playback information
      let playbackState = PlaybackState.UNKNOWN
      try {
        player.setCanGoPrev(true) // Never disabled to play it again, Sam

        player.setCanGoNext(this._getCanGoNext(appPlayerAction))

        const canPlay = this._getCanPlay(appPlayerAction)
        player.setCanPlay(canPlay)
        if (canPlay) playbackState = PlaybackState.PAUSED

        const canPause = this._getCanPause(appPlayerAction)
        player.setCanPause(canPause)
        if (canPause) playbackState = PlaybackState.PLAYING
      } catch (e) {
        Nuvola.log(`Error in getting playback state: ${e}`)
      }

      player.setPlaybackState(playbackState)
      player.setCanSeek(playbackState !== PlaybackState.UNKNOWN)
      player.setCanChangeVolume(playbackState !== PlaybackState.UNKNOWN)
    } catch (e) {
      Nuvola.log(`Error in WebApp.update: ${e}`)
    }

    // Schedule the next update
    setTimeout(this.update.bind(this), 500)
  }

  // Handler of playback actions
  WebApp._onActionActivated = function (emitter, name, param) {
    try {
      const bottomPlayerContainer = document.querySelector('div#bottomPlayerContainer')
      const appPlayerAction = bottomPlayerContainer.querySelector('div.player__action')

      switch (name) {
        case PlayerAction.NEXT_SONG:
          Nuvola.clickOnElement(appPlayerAction.querySelector('span.pct-player-next'))
          break
        case PlayerAction.PAUSE:
        case PlayerAction.STOP:
          Nuvola.clickOnElement(appPlayerAction.querySelector('span.pct-player-pause'))
          break
        case PlayerAction.PLAY:
          Nuvola.clickOnElement(appPlayerAction.querySelector('span.pct-player-play'))
          break
        case PlayerAction.TOGGLE_PLAY:
          try {
            Nuvola.clickOnElement(appPlayerAction.querySelector('span.pct-player-play'))
          } catch (e) {
            Nuvola.clickOnElement(appPlayerAction.querySelector('span.pct-player-pause'))
          }
          break
        case PlayerAction.PREV_SONG:
          Nuvola.clickOnElement(appPlayerAction.querySelector('span.pct-player-prev'))
          break
        case PlayerAction.SEEK: {
          // They were kind enough to use a <input type="range"> in seconds unit
          // but changing its value won't make the track seek */
          const inputRange = bottomPlayerContainer.querySelector('#inputTypeRange input')
          const total = inputRange.max * 1000000 // In microseconds
          if (param > 0 && param <= total) {
            Nuvola.triggerMouseEvent(inputRange, 'mousedown', param / total, 0.5)
            inputRange.value = Math.round(param / 1000000)
            Nuvola.triggerMouseEvent(inputRange, 'mouseup', param / total, 0.5)
          }
          break
        }
        case PlayerAction.CHANGE_VOLUME: {
          const rangeSlider = bottomPlayerContainer.querySelector('div.rangerslider-horizontal-wrapper')
          Nuvola.clickOnElement(rangeSlider, param, 0.5)
          break
        }
        case PlayerAction.SHUFFLE:
          Nuvola.clickOnElement(appPlayerAction.querySelector('span.pct-shuffle'))
          break
        case PlayerAction.REPEAT:
          this._setRepeat(param, appPlayerAction)
      }
    } catch (e) {
      Nuvola.log(`Error in WebApp._onActionActivated: ${e}`)
    }
  }

  WebApp.start()
})(this) // function(Nuvola)

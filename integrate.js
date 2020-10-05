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
  var player = Nuvola.$object(Nuvola.MediaPlayer)
  var volumeHandleRegex = /(\d+)px/

  // Handy aliases
  var PlaybackState = Nuvola.PlaybackState
  var PlayerAction = Nuvola.PlayerAction

  // Create new WebApp prototype
  var WebApp = Nuvola.$WebApp()

  // Initialization routines
  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    var state = document.readyState
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

  WebApp._getTrack = function (bottomPlayerContainer, playerTimeData) {
    var track = {}

    try {
      var currentAlbumData = bottomPlayerContainer.querySelectorAll('span.player__inner__container1__track__album > div > a')

      track.title = bottomPlayerContainer.querySelector('span.player__inner__container1__track__name > div').textContent
      track.artist = currentAlbumData[0].textContent
      track.album = currentAlbumData[1].textContent
      track.artLocation = bottomPlayerContainer.querySelector('div.player__inner__container1__cover > img').src
      track.length = playerTimeData[2].textContent
      // I could also report the current playlist but it's not (yet?) part of the Nuvola API
    } catch (e) {
      Nuvola.log(`Error in building track info: ${e}`)
    }

    // Return empty track data on error, to reset Nuvola display
    return track
  }

  WebApp._getTrackPosition = function (playerTimeData) {
    return playerTimeData[0].textContent
  }

  WebApp._getVolume = function (bottomPlayerContainer) {
    var volumeHandle = bottomPlayerContainer.querySelector('div.player__inner__container2__volume__slider div.rangeslider__fill')
    // The slider fill is hard-coded to be positioned at 95px on 100% volume
    var match = volumeHandleRegex.exec(volumeHandle.style.width)
    if (match && match.length) {
      return parseInt(match[1], 10) / 95
    }

    return 1.0
  }

  WebApp._getShuffle = function (playerControl) {
    try {
      return playerControl.querySelector('span.pct-shuffle').classList.contains('c2')
    } catch (e) {
      Nuvola.log(`Error in reading shuffle status: ${e}`)
      return null
    }
  }

  WebApp._getRepeat = function (playerControl) {
    try {
      var repeat = Nuvola.PlayerRepeat.NONE
      if (playerControl.querySelector('span.pct-repeat.c2') !== null) {
        repeat = Nuvola.PlayerRepeat.PLAYLIST
      } else if (playerControl.querySelector('span.pct-repeat-once.c2') !== null) {
        repeat = Nuvola.PlayerRepeat.TRACK
      }
      return repeat
    } catch (e) {
      Nuvola.log(`Error in reading repeat status: ${e}`)
      return null
    }
  }

  WebApp._setRepeat = function (repeat, playerControl) {
    var repeatControl = playerControl.querySelector('span.pct-repeat, span.pct-repeat-once')
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
      var bottomPlayerContainer = document.querySelector('div#bottomPlayerContainer')
      var playerTimeData = bottomPlayerContainer.querySelectorAll('div.player__inner__container1__time > div > span')

      // Update track information (always)
      player.setTrack(this._getTrack(bottomPlayerContainer, playerTimeData))

      // Update track position
      try {
        player.setTrackPosition(this._getTrackPosition(playerTimeData))
      } catch (e) {
        Nuvola.log(`Error in setting track position: ${e}`)
      }

      // Update volume level
      try {
        player.updateVolume(this._getVolume(bottomPlayerContainer))
      } catch (e) {
        Nuvola.log(`Error in updating volume level: ${e}`)
      }

      var appPlayerAction = bottomPlayerContainer.querySelector('div.player__inner__action')

      // Update shuffle status
      try {
        var shuffle = this._getShuffle(appPlayerAction)
        Nuvola.actions.updateEnabledFlag(PlayerAction.SHUFFLE, shuffle !== null)
        Nuvola.actions.updateState(PlayerAction.SHUFFLE, shuffle)
      } catch (e) {
        Nuvola.log(`Error in updating shuffle: ${e}`)
      }

      // Update repeat status
      try {
        var repeat = this._getRepeat(appPlayerAction)
        Nuvola.actions.updateEnabledFlag(PlayerAction.REPEAT, repeat !== null)
        Nuvola.actions.updateState(PlayerAction.REPEAT, repeat)
      } catch (e) {
        Nuvola.log(`Error in updating repeat: ${e}`)
      }

      // Update playback information
      var playbackState = PlaybackState.UNKNOWN
      try {
        player.setCanGoPrev(true) // Never disabled to play it again, Sam

        player.setCanGoNext(this._getCanGoNext(appPlayerAction))

        var canPlay = this._getCanPlay(appPlayerAction)
        player.setCanPlay(canPlay)
        if (canPlay) playbackState = PlaybackState.PAUSED

        var canPause = this._getCanPause(appPlayerAction)
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
      var bottomPlayerContainer = document.querySelector('div#bottomPlayerContainer')
      var appPlayerAction = bottomPlayerContainer.querySelector('div.player__inner__action')

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
        case PlayerAction.SEEK:
          // They were kind enough to use a <input type="range"> in seconds unit
          // but changing its value won't make the track seek */
          var inputRange = bottomPlayerContainer.querySelector('#inputTypeRange input')
          var total = inputRange.max * 1000000 // In microseconds
          if (param > 0 && param <= total) {
            Nuvola.clickOnElement(inputRange, param / total, 0.5)
          }
          break
        case PlayerAction.CHANGE_VOLUME:
          var rangeSlider = bottomPlayerContainer.querySelector('div.rangerslider-horizontal-wrapper')
          Nuvola.clickOnElement(rangeSlider, param, 0.5)
          break
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

/*
 * Copyright 2018 Bors, Ltd <github@bors-ltd.fr>
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
    player.setCanChangeVolume(false) // TODO (I never use it)
    player.setCanRate(false) // No rating on Qobuz

    // Connect handler for signal ActionActivated
    Nuvola.actions.connect('ActionActivated', this)

    // Start update routine
    this.update()
  }

  // Extract data from the web page
  WebApp.update = function () {
    try {
      // Wait for the bottom banner to be fully loaded on Qobuz bootstrap
      var bottomPlayerContainer = document.querySelector('div#bottomPlayerContainer')
      var playerTrack = bottomPlayerContainer.querySelector('div.player-track')
      var currentAlbumData = playerTrack.querySelectorAll('span.current-album > a')
      var playerTimeData = bottomPlayerContainer.querySelectorAll('div.player-time div span')

      // Update track information
      var track = {}
      try {
        track.title = playerTrack.querySelector('span.current-track > span').textContent
        track.artist = currentAlbumData[0].textContent
        track.album = currentAlbumData[1].textContent
        track.artLocation = bottomPlayerContainer.querySelector('div.player-cover > img').src
        track.length = playerTimeData[1].textContent
        // I could also report the current playlist but it's not (yet?) part of the Nuvola API
      } catch (e) {
        Nuvola.log(`Error in building track info: ${e}`)
      }

      player.setTrack(track)

      // Update track position
      try {
        player.setTrackPosition(playerTimeData[0].textContent)
      } catch (e) {
        Nuvola.log(`Error in setting track position: ${e}`)
      }

      // Update playback information
      var playbackState = PlaybackState.UNKNOWN
      try {
        var playerAction = bottomPlayerContainer.querySelector('div.player-action')

        player.setCanGoPrev(true) // Never disabled to play it again, Sam

        var enabled
        try {
          enabled = !playerAction.querySelector('span.pct-player-next').classList.contains('disable')
        } catch (e) {
          enabled = false
        }
        player.setCanGoNext(enabled)

        try {
          enabled = !!playerAction.querySelector('span.pct-player-play') // exists
        } catch (e) {
          enabled = false
        }
        player.setCanPlay(enabled)
        if (enabled) playbackState = PlaybackState.PAUSED

        try {
          enabled = !!playerAction.querySelector('span.pct-player-pause') // exists
        } catch (e) {
          enabled = false
        }
        player.setCanPause(enabled)
        if (enabled) playbackState = PlaybackState.PLAYING
      } catch (e) {
        Nuvola.log(`Error in getting playback state: ${e}`)
      }

      player.setPlaybackState(playbackState)
      player.setCanSeek(playbackState !== PlaybackState.UNKNOWN)
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
      var playerAction = bottomPlayerContainer.querySelector('div.player-action')
      switch (name) {
        case PlayerAction.NEXT_SONG:
          Nuvola.clickOnElement(playerAction.querySelector('span.pct-player-next'))
          break
        case PlayerAction.PAUSE:
        case PlayerAction.STOP:
          Nuvola.clickOnElement(playerAction.querySelector('span.pct-player-pause'))
          break
        case PlayerAction.PLAY:
          Nuvola.clickOnElement(playerAction.querySelector('span.pct-player-play'))
          break
        case PlayerAction.TOGGLE_PLAY:
          try {
            Nuvola.clickOnElement(playerAction.querySelector('span.pct-player-play'))
          } catch (e) {
            Nuvola.clickOnElement(playerAction.querySelector('span.pct-player-pause'))
          }
          break
        case PlayerAction.PREV_SONG:
          Nuvola.clickOnElement(playerAction.querySelector('span.pct-player-prev'))
          break
        case PlayerAction.SEEK:
          // They were kind enough to use a <input type="range"> in seconds unit
          // but changing its value won't make the track seek
          var inputRange = bottomPlayerContainer.querySelector('#inputTypeRange input')
          var total = inputRange.max * 1000000 // In microseconds
          if (param > 0 && param <= total) {
            Nuvola.clickOnElement(inputRange, param / total, 0.5)
          }
          break
      }
    } catch (e) {
      Nuvola.log(`Error in WebApp._onActionActivated: ${e}`)
    }
  }

  WebApp.start()
})(this)  // function(Nuvola)

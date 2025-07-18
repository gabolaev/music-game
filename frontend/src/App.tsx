import { useState, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import type { GameState, GameNominations, PlayerNominations, PlayedTrack } from '../../common/types'
import { PlayedTracksList } from './PlayedTracksList'
import { MyTracksList } from './MyTracksList'
import { TrackPlayer } from './TrackPlayer'
import { UrlPreview } from './UrlPreview'
import { getMusicService } from './utils/musicServices'
import './App.css'

const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string

// Define a type for socket responses
type SocketResponse = { success: boolean; [key: string]: unknown }

function App() {
  const [mode, setMode] = useState<'lobby' | 'game' | 'loading'>('lobby')
  const [socket, setSocket] = useState<Socket | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [username, setUsername] = useState(localStorage.getItem('username') || '')
  const [gameId, setGameId] = useState(localStorage.getItem('gameId') || '')
  const [error, setError] = useState<string | null>(null)
  const [trackUrl, setTrackUrl] = useState('')
  const [vote, setVote] = useState('')
  const [isGameIdCopied, setIsGameIdCopied] = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [nominations, setNominations] = useState<GameNominations | null>(null)
  const [showRules, setShowRules] = useState(false)

  const getSocket = useCallback(() => {
    let s = socket
    if (!s) {
      s = io(VITE_BACKEND_URL)
      setSocket(s)
    }
    return s
  }, [socket])

  const handleCreateGame = () => {
    setMode('loading')
    setError(null)
    const s = getSocket()
    s.emit('createGame', { username, settings: { tracksPerPlayer: 2 } }, (res: SocketResponse) => {
      if (res.success) {
        if (typeof res.gameId === 'string') {
          setGameId(res.gameId)
          localStorage.setItem('gameId', res.gameId)
        } else {
          setGameId('')
        }
        localStorage.setItem('username', username)
        setMode('game')
      } else {
        setError(typeof res.error === 'string' ? res.error : 'Failed to create game')
        setMode('lobby')
      }
    })
  }

  const handleJoinGame = () => {
    setMode('loading')
    setError(null)
    const s = getSocket()
    s.emit('joinGame', { gameId, username }, (res: SocketResponse) => {
      if (res.success) {
        setGameId(gameId)
        localStorage.setItem('gameId', gameId)
        localStorage.setItem('username', username)
        setMode('game')
      } else {
        setError(typeof res.error === 'string' ? res.error : 'Failed to join game')
        setMode('lobby')
      }
    })
  }

  const handleSubmitTrack = () => {
    if (!trackUrl) return
    const s = getSocket()
    s.emit('submitTrack', {
      gameId,
      username,
      track: {
        id: `${username}-${Date.now()}`,
        url: trackUrl,
      },
    }, (res: SocketResponse) => {
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to submit track')
      } else {
        setTrackUrl('')
      }
    })
  }

  const handleRemoveTrack = (trackId: string) => {
    const s = getSocket()
    s.emit('removeTrack', { gameId, username, trackId }, (res: SocketResponse) => {
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to remove track')
      }
    })
  }

  const handleChangeTracksPerPlayer = (tracksPerPlayer: number) => {
    const s = getSocket()
    s.emit('changeGameSetting', { gameId, username, newSettings: { tracksPerPlayer } }, (res: SocketResponse) => {
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to change setting')
      }
    })
  }

  const handleStartGame = () => {
    const s = getSocket()
    s.emit('startGame', { gameId, username }, (res: SocketResponse) => {
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to start game')
      }
    })
  }

  const handleVote = () => {
    const s = getSocket()
    s.emit('vote', { gameId, username, voteFor: vote }, (res: SocketResponse) => {
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to vote')
      }
    })
  }

  const handleRevealResults = () => {
    const s = getSocket()
    s.emit('revealResults', { gameId, username }, (res: SocketResponse) => {
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to reveal results')
      }
    })
  }

  const handleNextRound = () => {
    const s = getSocket()
    s.emit('nextRound', { gameId, username }, (res: SocketResponse) => {
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to start next round')
      }
    })
  }

  const handleCopyGameId = () => {
    if (!gameState) return
    const fullUrl = `${window.location.origin}${window.location.pathname}#${gameState.id}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      setIsGameIdCopied(true)
      setTimeout(() => setIsGameIdCopied(false), 2000)
    }).catch(err => {
      console.error('Failed to copy Game URL:', err)
      // You could show an error message to the user here
      setError('Failed to copy Game URL')
      setTimeout(() => setError(null), 2000)
    })
  }

  const handleLikeTrack = () => {
    if (!gameState) return
    setLikeLoading(true)
    const s = getSocket()
    s.emit('likeTrack', { gameId, username }, (res: SocketResponse) => {
      setLikeLoading(false)
      if (!res.success) {
        setError(typeof res.error === 'string' ? res.error : 'Failed to like track')
        setTimeout(() => setError(null), 3000)
      }
    })
  }

  const handleReturnToLobby = () => {
    const s = getSocket();
    s.emit('leaveGame', { gameId, username }, (res: SocketResponse) => {
      if (!res.success) {
        console.error('Failed to leave game on backend, but leaving on client anyway');
      }
    });
    localStorage.removeItem('gameId');
    localStorage.removeItem('username');
    setGameId('');
    setUsername('');
    setGameState(null);
    setMode('lobby');
  };

  const handleIncrementTracks = () => {
    const currentValue = gameState?.gameSettings.tracksPerPlayer || 2;
    if (currentValue < 5) {
        handleChangeTracksPerPlayer(currentValue + 1);
    }
  }

  const handleDecrementTracks = () => {
    const currentValue = gameState?.gameSettings.tracksPerPlayer || 2;
    if (currentValue > 1) {
        handleChangeTracksPerPlayer(currentValue - 1);
    }
  }

  // Auto-reconnect on mount if gameId and username are in localStorage
  useEffect(() => {
    const savedGameId = localStorage.getItem('gameId')
    const savedUsername = localStorage.getItem('username')
    if (savedGameId && savedUsername) {
      setMode('loading')
      const s = getSocket()
      s.emit('reconnectPlayer', { gameId: savedGameId, username: savedUsername }, (res: { success: boolean }) => {
        if (res.success) {
          setGameId(savedGameId)
          setUsername(savedUsername)
          setMode('game')
        } else {
          setMode('lobby')
          // Check for URL hash only if reconnection failed
          const hash = window.location.hash
          if (hash && hash.startsWith('#')) {
            const gameIdFromHash = hash.substring(1)
            if (gameIdFromHash) {
              setGameId(gameIdFromHash)
            }
          }
        }
      })
    } else {
      // No saved credentials, check for URL hash
      const hash = window.location.hash
      if (hash && hash.startsWith('#')) {
        const gameIdFromHash = hash.substring(1)
        if (gameIdFromHash) {
          setGameId(gameIdFromHash)
        }
      }
    }
  }, [])

  // Sync local vote state with game state
  useEffect(() => {
    if (gameState?.gamePhase === 'RoundInProgress') {
      if (gameState.currentRoundData?.track.id !== localStorage.getItem('lastVotedTrackId')) {
        setVote('');
        localStorage.setItem('lastVotedTrackId', gameState.currentRoundData?.track.id || '');
      }
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState?.gamePhase === 'GameFinished' && !nominations) {
      const s = getSocket();
      s.emit('getGameNominations', { gameId }, (res: SocketResponse) => {
        if (res.success) {
          setNominations(res.nominations as GameNominations);
        }
      });
    }
  }, [gameState, nominations, gameId, getSocket]);

  useEffect(() => {
    if (socket) {
      const handleGameState = (state: GameState) => {
        setGameState(state);
      };
      socket.on('gameState', handleGameState);
      return () => {
        socket.off('gameState', handleGameState);
      };
    }
  }, [socket]);

  if (mode === 'loading') {
    return (
      <div className="app-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          Connecting to game...
        </div>
      </div>
    )
  }

  if (mode === 'lobby') {
    return (
      <div className="app-container">
        <div className="lobby">
          <h1>Secret DJ</h1>
          <p className="text-secondary">Share your favorite tracks and guess who submitted what!</p>
          
          <div className="rules-section">
            <button 
              className="rules-toggle" 
              onClick={() => setShowRules(!showRules)}
            >
              {showRules ? '📖 Hide Rules' : '📖 How to Play'}
            </button>
            
            {showRules && (
              <div className="rules-content">
                <h3>How to Play</h3>
                <p><strong>🎵 Main Goal:</strong> Share your favorite music and like amazing new tracks from your friends!</p>
                <p><strong>1. Share Music:</strong> Submit your favorite tracks in the lobby to share your musical taste.</p>
                <p><strong>2. Like & Enjoy:</strong> Listen to tracks and click "Like" when you find something you love.</p>
                <p><strong>3. Guess:</strong> Try to guess who submitted each track!</p>
                <p><strong>4. Celebrate:</strong> At the end, see the final results and celebrate your favorite tracks!</p>
                <p><em>💡 Remember: Don't try to game the stats! The goal is to have fun and share music with friends. It's not much of a competition.</em></p>
              </div>
            )}
          </div>
          
          <form className="lobby-form" onSubmit={(e) => e.preventDefault()}>
            <div className="lobby-input-group">
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            
            <div className="lobby-input-group">
              <input
                id="gameId"
                type="text"
                placeholder="Enter game ID"
                value={gameId}
                onChange={e => setGameId(e.target.value)}
              />
            </div>
            
            <div className="lobby-actions">
              {!gameId && (
                <button 
                  className="btn-primary" 
                  onClick={handleCreateGame} 
                  disabled={!username}
                >
                  Create New Game
                </button>
              )}
              <button 
                className="btn-secondary" 
                onClick={handleJoinGame} 
                disabled={!username || !gameId}
              >
                Join Game
              </button>
            </div>
          </form>
          
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    )
  }

  // Main game UI for all phases
  if (mode === 'game' && gameState) {
    const me = gameState.players.find(p => p.username === username)
    const isAdmin = me?.isAdmin || false
    const myTracks = me?.tracks || []
    const allPlayersReady = gameState.players.every(p => (p.trackCount || 0) >= (gameState.gameSettings.tracksPerPlayer || 2))

    const renderAdminControls = () => {
      if (!isAdmin) return null;

      const buttonMap = {
        Lobby: (
          <button 
            className="btn-primary btn-large w-full" 
            onClick={handleStartGame} 
            disabled={!allPlayersReady}
            title={!allPlayersReady ? 'Waiting for all players to submit their tracks' : 'Start the game'}
          >
            Start Game
          </button>
        ),
        VotesTallied: (
          <button className="btn-primary btn-large w-full" onClick={handleRevealResults}>
            Reveal Results
          </button>
        ),
        RoundResults: (
          <button className="btn-primary btn-large w-full" onClick={handleNextRound}>
            {gameState.playedTrackIds.length === gameState.players.reduce((acc, p) => acc + (p.trackCount || 0), 0) ? 'Finish Game' : 'Next Round'}
          </button>
        ),
        AwaitingNextRound: (
          <button className="btn-primary btn-large w-full" onClick={handleNextRound}>
            Next Round
          </button>
        ),
      };

      const button = buttonMap[gameState.gamePhase as keyof typeof buttonMap];

      if (!button) return null;

      return (
        <div className="mb-xl">
          {button}
        </div>
      );
    }

    const renderLeftPanel = () => {
      const showMyTracks = gameState.gamePhase !== 'Lobby' && me && (me.tracks || []).length > 0;
      const showTrackHistory = gameState.playedTracks.length > 0;

      return (
        <div className="sidebar-panel">
          {renderAdminControls()}
          {gameState.gamePhase === 'Lobby' && (
            <div className="game-settings-container">
              <h3>Game Settings</h3>
              <div className="settings-row">
                <span className="settings-label">Tracks per player</span>
                {isAdmin ? (
                  <div className="number-input-group">
                    <button
                      className="number-input-btn"
                      onClick={handleDecrementTracks}
                      disabled={(gameState.gameSettings.tracksPerPlayer || 2) <= 1}
                    >
                      -
                    </button>
                    <span className="number-input-value">{gameState.gameSettings.tracksPerPlayer}</span>
                    <button
                      className="number-input-btn"
                      onClick={handleIncrementTracks}
                      disabled={(gameState.gameSettings.tracksPerPlayer || 2) >= 5}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <span className="settings-value">{gameState.gameSettings.tracksPerPlayer}</span>
                )}
              </div>
            </div>
          )}
          <h3>Players</h3>
          <ul className={`players-list ${gameState.gamePhase === 'Lobby' ? 'in-lobby' : ''}`}>
            {gameState.players.map((player) => {
              const tracksSubmitted = player.trackCount;
              const ready = tracksSubmitted >= (gameState.gameSettings.tracksPerPlayer || 2)
              return (
                <li key={player.username} className={`player-item ${ready ? 'is-ready' : ''}`}>
                  <div className="player-info-left">
                    <div className="player-avatar">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="player-name">
                        {player.username}
                        {player.isAdmin && <span className="admin-icon"> 👑</span>}
                      </div>
                      <div className="player-status">
                        {player.isConnected ? (
                          <span className="connected">● Connected</span>
                        ) : (
                          <span className="disconnected">● Disconnected</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="player-tracks">
                    {tracksSubmitted}/{gameState.gameSettings.tracksPerPlayer || 2}
                    {ready && <span className="player-ready"> ✓</span>}
                  </div>
                </li>
              )
            })}
          </ul>

          {(showMyTracks || showTrackHistory) && (
            <div className="animate-fade-in">
              {showMyTracks && (
                <div className="mt-lg">
                  <h3>My Tracks</h3>
                  <MyTracksList
                    myTracks={myTracks}
                    playedTrackIds={gameState.playedTrackIds}
                    currentTrackId={gameState.gamePhase === 'RoundInProgress' ? gameState.currentRoundData?.track?.id : undefined}
                  />
                </div>
              )}
              {showTrackHistory && gameState.gamePhase !== 'GameFinished' && (
                <div className="mt-lg">
                  <h3>Played Tracks</h3>
                  <PlayedTracksList playedTracks={gameState.playedTracks} currentUsername={username} />
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    const renderCenterPanel = () => {
      // LOBBY PHASE
      if (gameState.gamePhase === 'Lobby') {
        const allTracksSubmitted = myTracks.length >= (gameState.gameSettings.tracksPerPlayer || 2);
        return (
          <div className="game-phase">
            <div className="phase-header">
              <h2 className="phase-title">Game Lobby</h2>
              <p className="phase-description">
                {allTracksSubmitted
                  ? 'You are all set! Waiting for other players to submit their tracks.'
                  : 'Submit your tracks and wait for everyone to be ready'}
              </p>
            </div>

            <div className="track-submission-container">
              {!allTracksSubmitted && (
                <div className="track-submission">
                  <h3>My Tracks</h3>
                  <div 
                    className="track-input-wrapper"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmitTrack();
                      }
                    }}
                  >
                    <UrlPreview
                      url={trackUrl}
                      onUrlChange={setTrackUrl}
                      disabled={allTracksSubmitted}
                      placeholder={allTracksSubmitted ? "You have submitted all your tracks" : "Paste a music track URL..."}
                    />
                    <button 
                      onClick={handleSubmitTrack} 
                      className="btn-primary track-submit-btn"
                      disabled={!trackUrl || allTracksSubmitted}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}
              {allTracksSubmitted && (
                <div className="success-message">
                  You have submitted all your tracks. Waiting for others...
                </div>
              )}
              <MyTracksList 
                myTracks={myTracks} 
                playedTrackIds={gameState.playedTrackIds} 
                showRemoveButtons={true}
                onRemoveTrack={handleRemoveTrack} 
              />
            </div>
          </div>
        )
      }

      // ROUND IN PROGRESS OR VOTES TALLIED
      if ((gameState.gamePhase === 'RoundInProgress' || gameState.gamePhase === 'VotesTallied') && gameState.currentRoundData) {
        const isMyTrack = !!me?.tracks?.some(t => t.id === gameState.currentRoundData?.track.id);
        const hasLiked = !!gameState.currentRoundData.likes?.[username];
        const likeCount = Object.keys(gameState.currentRoundData.likes || {}).length;
        const likers = Object.keys(gameState.currentRoundData.likes || {});
        const votesTallied = gameState.gamePhase === 'VotesTallied';

        return (
          <div className="game-phase">
            <div className="phase-header">
              <h2 className="phase-title">
                {votesTallied ? 'Votes are in!' : 'Round in Progress'}
              </h2>
              <p className="phase-description">
                {votesTallied ? 'All eligible players have voted.' : 'Listen to the track and guess who submitted it!'}
              </p>
            </div>

            <div className="track-player-section">
              {gameState.currentRoundData?.track?.url ? (
                <div className="track-player-container">
                  <TrackPlayer url={gameState.currentRoundData.track.url} />
                </div>
              ) : (
                <div className="loading">
                  <div className="loading-spinner"></div>
                  Loading track...
                </div>
              )}

              {!votesTallied && (
                <div className="like-section">
                  {!isMyTrack && (
                    <button 
                      className={`like-button ${hasLiked ? 'liked' : ''}`}
                      onClick={handleLikeTrack} 
                      disabled={likeLoading}
                    >
                      {likeLoading ? (
                        <div className="loading-spinner-small"></div>
                      ) : hasLiked ? (
                        '❤️ LIKED!'
                      ) : (
                        '🤍 LIKE'
                      )}
                    </button>
                  )}
                  
                  {gameState.currentRoundData.likes && likeCount > 0 && (
                    <div className="like-count">
                      {likeCount} {likeCount === 1 ? 'like' : 'likes'}
                      {isMyTrack && likers.length > 0 && (
                        <span className="likers-list">
                          ({likers.join(', ')})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!votesTallied ? (
              <div className="voting-section">
                <h3 className="voting-title">Whose track is this?</h3>
                {isMyTrack ? (
                  <div className="success-message">
                    This is your track! Just enjoy it and see how others vote.
                  </div>
                ) : (
                  <div className="voting-form">
                    <select 
                      value={vote} 
                      onChange={e => setVote(e.target.value)}
                      className="voting-select"
                    >
                      <option value="">-- Select a player --</option>
                      {gameState.players
                        .filter(p => p.username !== username)
                        .map(p => (
                          <option key={p.username} value={p.username}>
                            {p.username}
                          </option>
                        ))}
                    </select>
                    <button 
                      className="btn-primary" 
                      onClick={handleVote} 
                      disabled={!vote}
                    >
                      Submit Vote
                    </button>
                  </div>
                )}

                {gameState.currentRoundData && typeof gameState.currentRoundData.votesCast === 'number' && typeof gameState.currentRoundData.totalVoters === 'number' && (
                  <div className="vote-counter">
                    Votes: {gameState.currentRoundData.votesCast} / {gameState.currentRoundData.totalVoters}
                  </div>
                )}
              </div>
            ) : (
              <div className="voting-section">
                {!isAdmin && (
                  <div className="success-message text-center">
                    Waiting for admin to reveal results...
                  </div>
                )}
              </div>
            )}
          </div>
        )
      }

      // ROUND RESULTS
      if (gameState.gamePhase === 'RoundResults' && gameState.currentRoundData && gameState.currentRoundData.results) {
        const { results } = gameState.currentRoundData
        
        return (
          <div className="game-phase">
            <div className="phase-header">
              <h2 className="phase-title">Round Results</h2>
              <p className="phase-description">
                The song was submitted by <strong className="text-accent">{results.correctOwner}</strong>
              </p>
            </div>

            <div className="track-player-section">
              {gameState.currentRoundData?.track?.url ? (
                <div className="track-player-container">
                  <TrackPlayer url={gameState.currentRoundData.track.url} />
                </div>
              ) : (
                <div className="loading">
                  <div className="loading-spinner"></div>
                  Loading track...
                </div>
              )}
            </div>

            <div className="results-section">
              <div className="results-grid">
                <div className="results-card">
                  <h4>Votes</h4>
                  <ul className="results-list">
                    {results.votes.map(v => (
                      <li key={v.voter}>
                        <span>{v.voter} guessed {v.guessed}</span>
                        <span className={v.correct ? 'correct-guess' : 'incorrect-guess'}>
                          {v.correct ? '✓' : '✗'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="results-card">
                  <h4>Likes</h4>
                  <div className="text-center">
                    <div className="text-accent" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                      ❤️ {results.likeCount || 0}
                    </div>
                    {results.likers && results.likers.length > 0 && (
                      <div className="text-secondary">
                        {results.likers.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      // GAME FINISHED
      if (gameState.gamePhase === 'GameFinished') {

        const renderNominations = () => {
          if (!nominations) {
            return (
              <div className="loading">
                <div className="loading-spinner"></div>
                Calculating nominations...
              </div>
            );
          }

          // Define the allowed nomination fields for type safety
          type NominationField = 'mostLiked' | 'tasteExpert' | 'mostLikedTrack' | 'musicCollector' | 'mysteryMaster';

          const nominationConfig = [
            {
              emoji: '🏆',
              title: 'Most Liked',
              description: 'Received the most likes from others',
              field: 'mostLiked' as NominationField,
              unit: 'likes',
              sort: (a: PlayerNominations, b: PlayerNominations) => b.mostLiked - a.mostLiked,
              best: (sorted: PlayerNominations[]) => sorted.length > 0 ? sorted[0].mostLiked : 0,
              isLowerBetter: false,
            },
            {
              emoji: '💎',
              title: 'Most Liked Track',
              description: 'Had the track with the most likes',
              field: 'mostLikedTrack' as NominationField,
              unit: 'likes',
              sort: (a: PlayerNominations, b: PlayerNominations) => b.mostLikedTrack - a.mostLikedTrack,
              best: (sorted: PlayerNominations[]) => sorted.length > 0 ? sorted[0].mostLikedTrack : 0,
              isLowerBetter: false,
            },
            {
              emoji: '🎯',
              title: 'Taste Expert',
              description: 'Correctly guessed the authors of most tracks',
              field: 'tasteExpert' as NominationField,
              unit: 'guesses',
              sort: (a: PlayerNominations, b: PlayerNominations) => b.tasteExpert - a.tasteExpert,
              best: (sorted: PlayerNominations[]) => sorted.length > 0 ? sorted[0].tasteExpert : 0,
              isLowerBetter: false,
            },
            {
              emoji: '🕵️',
              title: 'Mystery Master',
              description: 'Managed to hide his identity the best (why would you do that?)',
              field: 'mysteryMaster' as NominationField,
              unit: 'times',
              sort: (a: PlayerNominations, b: PlayerNominations) => a.mysteryMaster - b.mysteryMaster, // ascending
              best: (sorted: PlayerNominations[]) => sorted.length > 0 ? sorted[0].mysteryMaster : 0,
              isLowerBetter: true,
            },
            {
              emoji: '🎵',
              title: 'Music Collector',
              description: 'Liked the most tracks',
              field: 'musicCollector' as NominationField,
              unit: 'likes',
              sort: (a: PlayerNominations, b: PlayerNominations) => b.musicCollector - a.musicCollector,
              best: (sorted: PlayerNominations[]) => sorted.length > 0 ? sorted[0].musicCollector : 0,
              isLowerBetter: false,
            },
          ];

          return (
            <div className="nominations-grid">
              {nominationConfig.map(nom => {
                // Sort players by this nomination field
                const sorted = [...nominations.players].sort(nom.sort);
                const topScore = nom.best(sorted);
                return (
                  <div key={nom.title} className="nomination-card">
                    <div className="nomination-emoji">{nom.emoji}</div>
                    <h4 className="nomination-title">{nom.title}</h4>
                    <p className="nomination-description">{nom.description}</p>
                    <div className="nomination-winner">
                      {sorted.map((player) => {
                        const value = player[nom.field];
                        const isTop = nom.isLowerBetter ? value === topScore : value === topScore && topScore > 0;
                        if (nom.title === 'Most Liked Track' && gameState) {
                          // Find this player's most liked track
                          const playerTracks = gameState.playedTracks.filter(pt => pt.ownerUsername === player.username);
                          const mostLikedTrack = playerTracks.reduce((max, t) => (t.likes?.length || 0) > (max.likes?.length || 0) ? t : max, playerTracks[0]);
                          const mostLikedCount = mostLikedTrack && mostLikedTrack.likes ? mostLikedTrack.likes.length : 0;
                          const mostLikedTitle = mostLikedTrack && mostLikedCount > 0 ? mostLikedTrack.track.title || mostLikedTrack.track.url : null;
                          return (
                            <div key={player.username} className="nomination-track-row">
                              <span className="winner-name">
                                {player.username}
                                {isTop && <span title="Top player" style={{ marginLeft: 4 }}>🏆</span>}
                              </span>
                              {mostLikedCount > 0 ? (
                                <span className="nomination-track-info">
                                  <span className="nomination-track-title">{mostLikedTitle}</span>
                                  <span className="nomination-track-likes">
                                    <span role="img" aria-label="likes">❤️</span> {mostLikedCount}
                                  </span>
                                </span>
                              ) : (
                                <span className="nomination-track-none">-</span>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <div key={player.username} style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4}}>
                              <span className="winner-name">
                                {player.username}
                                {isTop && (
                                  <span title="Top player" style={{marginLeft: 4}}>🏆</span>
                                )}
                              </span>
                              <span className="winner-score">{value}</span>
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }

        return (
          <div className="game-phase">
            <div className="phase-header">
              <h2 className="phase-title">Game Over!</h2>
              <p className="phase-description">Thanks for playing! Here are the final results.</p>
            </div>

            <div className="results-section">
              <h3 className="results-title">✨ Nominations</h3>
              {renderNominations()}
            </div>

            <div className="results-section">
              <h3 className="results-title">🎶 Played Tracks</h3>
              <FinalPlayedTracksList playedTracks={gameState.playedTracks} currentUsername={username} />
            </div>

            <div className="text-center mt-xl">
              <button className="btn-secondary btn-large" onClick={handleReturnToLobby}>
                Exit
              </button>
            </div>
          </div>
        )
      }

      // Fallback
      return (
        <div className="game-phase">
          <div className="loading">
            <div className="loading-spinner"></div>
            Loading game...
          </div>
        </div>
      )
    }

    return (
      <div className="app-container">
        <header className="game-header">
          <div className="game-header-left">
            <h1 className="game-title">Secret DJ</h1>
            <div className="game-info">
              <span>Game: <span className="game-id" onClick={handleCopyGameId} title="Click to copy">{isGameIdCopied ? 'Copied!' : gameState.id}</span></span>
              <div className="player-info">
                <div className="player-avatar">
                  {username.charAt(0).toUpperCase()}
                </div>
                <span>{username}</span>
              </div>
            </div>
          </div>
          
          <div className="game-header-actions">
            <button className="btn-secondary" onClick={handleReturnToLobby}>
              <span className="desktop-only">Exit</span>
              <span className="mobile-only">🚪</span>
            </button>
          </div>
        </header>

        <main className="game-content">
          {renderLeftPanel()}
          <div className="center-panel">
            {renderCenterPanel()}
          </div>
        </main>
      </div>
    );
  }

  // Fallback: If in game mode but no gameState, show the lobby screen
  if (mode === 'game') {
    return (
      <div className="app-container">
        <div className="lobby">
          <h1>Secret DJ</h1>
          <p className="text-secondary">Share your favorite tracks and guess who submitted what!</p>
          
          <div className="rules-section">
            <button 
              className="rules-toggle" 
              onClick={() => setShowRules(!showRules)}
            >
              {showRules ? '📖 Hide Rules' : '📖 How to Play'}
            </button>
            
            {showRules && (
              <div className="rules-content">
                <h3>How to Play</h3>
                <p><strong>🎵 Main Goal:</strong> Share your favorite music and like amazing new tracks from your friends!</p>
                <p><strong>1. Share Music:</strong> Submit your favorite tracks in the lobby to share your musical taste.</p>
                <p><strong>2. Like & Enjoy:</strong> Listen to tracks and click "Like" when you find something you love.</p>
                <p><strong>3. Guess:</strong> Try to guess who submitted each track!</p>
                <p><strong>4. Celebrate:</strong> At the end, see the final results and celebrate your favorite tracks!</p>
                <p><em>💡 Remember: Don't try to game the stats! The goal is to have fun and share music with friends. It's not much of a competition.</em></p>
              </div>
            )}
          </div>
          
          <form className="lobby-form" onSubmit={(e) => e.preventDefault()}>
            <div className="lobby-input-group">
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            
            <div className="lobby-input-group">
              <input
                id="gameId"
                type="text"
                placeholder="Enter game ID"
                value={gameId}
                onChange={e => setGameId(e.target.value)}
              />
            </div>
            
            <div className="lobby-actions">
              {!gameId && (
                <button 
                  className="btn-primary" 
                  onClick={handleCreateGame} 
                  disabled={!username}
                >
                  Create New Game
                </button>
              )}
              <button 
                className="btn-secondary" 
                onClick={handleJoinGame} 
                disabled={!username || !gameId}
              >
                Join Game
              </button>
            </div>
          </form>
          
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="app-container">
      <div className="loading">
        <div className="loading-spinner"></div>
        Loading...
      </div>
    </div>
  )
}

// FinalPlayedTracksList: for the final screen, shows author and likers
function FinalPlayedTracksList({ playedTracks, currentUsername }: { playedTracks: PlayedTrack[], currentUsername: string }) {
  return (
    <div className="played-tracks-list">
      <ul className="tracks-list">
        {playedTracks.map(({ track, likes, ownerUsername }) => {
          const service = getMusicService(track.url);
          const isLiked = likes?.includes(currentUsername);
          return (
            <li key={track.id} className={`track-item${isLiked ? ' liked' : ''}`}>
              <a href={track.url} target="_blank" rel="noopener noreferrer" className="track-link" style={{ width: '100%' }}>
                {service && (
                  <img src={service.logo} alt={service.name} className="track-service-logo" />
                )}
                <span className="track-title">{track.title || track.url}</span>
                <span className="track-owner" style={{marginLeft: 12, fontStyle: 'italic', color: 'var(--text-tertiary)'}}>
                  by {ownerUsername}
                </span>
                {likes && likes.length > 0 && (
                  <span className="track-likes" style={{marginLeft: 'auto', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4}}>
                    <span role="img" aria-label="likes">❤️</span> {likes.join(', ')}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default App

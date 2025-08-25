"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Gauge,
    Pause,
    Play,
    RotateCcw,
    Volume2,
    VolumeX,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"
type Position = { x: number; y: number }
type GameState = "MENU" | "PLAYING" | "PAUSED" | "GAME_OVER"
type Level = 1 | 2 | 3
type Speed = "SLOW" | "NORMAL" | "FAST"
type Theme = "NEON" | "RETRO" | "MATRIX"

interface GameConfig {
  gridSize: number
  speed: number
  name: string
}

const LEVELS: Record<Level, GameConfig> = {
  1: { gridSize: 15, speed: 400, name: "ROOKIE" },
  2: { gridSize: 18, speed: 300, name: "HACKER" },
  3: { gridSize: 20, speed: 200, name: "MATRIX" },
}

const SPEED_MULTIPLIERS: Record<Speed, { multiplier: number; name: string }> = {
  SLOW: { multiplier: 1.5, name: "Slow" },
  NORMAL: { multiplier: 1, name: "Normal" },
  FAST: { multiplier: 0.7, name: "Fast" },
}

export default function SnakeGame() {
  const [gameState, setGameState] = useState<GameState>("MENU")
  const [level, setLevel] = useState<Level>(1)
  const [speed, setSpeed] = useState<Speed>("SLOW")
  const [theme, setTheme] = useState<Theme>("NEON")
  const [snake, setSnake] = useState<Position[]>([{ x: 7, y: 7 }])
  const [food, setFood] = useState<Position>({ x: 10, y: 10 })
  const [direction, setDirection] = useState<Direction>("RIGHT")
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const gameLoopRef = useRef<NodeJS.Timeout>()
  const audioContextRef = useRef<AudioContext>()
  const touchStartRef = useRef<Position | null>(null)
  const [eatFlash, setEatFlash] = useState(false)

  const currentConfig = LEVELS[level]
  const actualSpeed = Math.round(currentConfig.speed * SPEED_MULTIPLIERS[speed].multiplier)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioContextRef.current = new AudioContextClass()
      const savedHighScore = localStorage.getItem("snake-high-score")
      if (savedHighScore) setHighScore(Number.parseInt(savedHighScore))
    }
  }, [])

  const playSound = useCallback(
    (frequency: number, duration: number, type: OscillatorType = "square") => {
      if (!soundEnabled || !audioContextRef.current) return

      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type
      gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration)

      oscillator.start(audioContextRef.current.currentTime)
      oscillator.stop(audioContextRef.current.currentTime + duration)
    },
    [soundEnabled],
  )

  const generateFood = useCallback((snakeBody: Position[], gridSize: number): Position => {
    let newFood: Position
    do {
      newFood = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      }
    } while (snakeBody.some((segment) => segment.x === newFood.x && segment.y === newFood.y))
    return newFood
  }, [])

  const resetGame = useCallback(() => {
    console.log("[v0] Resetting game with level:", level, "grid size:", currentConfig.gridSize)
    const center = Math.floor(currentConfig.gridSize / 2)
    const initialSnake = [{ x: center, y: center }]
    setSnake(initialSnake)
    setFood(generateFood(initialSnake, currentConfig.gridSize))
    setDirection("RIGHT")
    setScore(0)
    setGameState("PLAYING")
  }, [currentConfig.gridSize, generateFood, level])

  const startGame = (selectedLevel: Level) => {
    console.log("[v0] Starting game with level:", selectedLevel)
    setLevel(selectedLevel)

    const levelConfig = LEVELS[selectedLevel]
    const center = Math.floor(levelConfig.gridSize / 2)
    const initialSnake = [{ x: center, y: center }]

    setSnake(initialSnake)
    setFood(generateFood(initialSnake, levelConfig.gridSize))
    setDirection("RIGHT")
    setScore(0)
    setGameState("PLAYING")

    playSound(600, 0.2, "sine")
    console.log("[v0] Game initialized with grid size:", levelConfig.gridSize)
  }

  useEffect(() => {
    if (gameState !== "PLAYING") return

    gameLoopRef.current = setInterval(() => {
      setSnake((currentSnake) => {
        const head = currentSnake[0]
        let newHead: Position

        switch (direction) {
          case "UP":
            newHead = { x: head.x, y: head.y - 1 }
            break
          case "DOWN":
            newHead = { x: head.x, y: head.y + 1 }
            break
          case "LEFT":
            newHead = { x: head.x - 1, y: head.y }
            break
          case "RIGHT":
            newHead = { x: head.x + 1, y: head.y }
            break
        }

        if (
          newHead.x < 0 ||
          newHead.x >= currentConfig.gridSize ||
          newHead.y < 0 ||
          newHead.y >= currentConfig.gridSize
        ) {
          setGameState("GAME_OVER")
          playSound(150, 0.5, "sawtooth")
          return currentSnake
        }

        if (currentSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
          setGameState("GAME_OVER")
          playSound(150, 0.5, "sawtooth")
          return currentSnake
        }

        const newSnake = [newHead, ...currentSnake]

        if (newHead.x === food.x && newHead.y === food.y) {
          const newScore = score + level * 10
          setScore(newScore)
          if (newScore > highScore) {
            setHighScore(newScore)
            localStorage.setItem("snake-high-score", newScore.toString())
          }
          setFood(generateFood(newSnake, currentConfig.gridSize))
          playSound(800, 0.1, "sine")
          setEatFlash(true)
          setTimeout(() => setEatFlash(false), 120)
          return newSnake
        }

        return newSnake.slice(0, -1)
      })
    }, actualSpeed)

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current)
    }
  }, [
    gameState,
    direction,
    food,
    score,
    highScore,
    level,
    actualSpeed,
    generateFood,
    playSound,
    currentConfig.gridSize,
  ])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState !== "PLAYING") return

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          if (direction !== "DOWN") setDirection("UP")
          break
        case "ArrowDown":
        case "s":
        case "S":
          if (direction !== "UP") setDirection("DOWN")
          break
        case "ArrowLeft":
        case "a":
        case "A":
          if (direction !== "RIGHT") setDirection("LEFT")
          break
        case "ArrowRight":
        case "d":
        case "D":
          if (direction !== "LEFT") setDirection("RIGHT")
          break
        case " ":
          e.preventDefault()
          setGameState(gameState === "PLAYING" ? "PAUSED" : "PLAYING")
          break
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameState, direction])

  const handleDirectionChange = (newDirection: Direction) => {
    if (gameState !== "PLAYING") return

    const opposites: Record<Direction, Direction> = {
      UP: "DOWN",
      DOWN: "UP",
      LEFT: "RIGHT",
      RIGHT: "LEFT",
    }

    if (direction !== opposites[newDirection]) {
      setDirection(newDirection)
      playSound(400, 0.05, "square")
    }
  }

  const onGridTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  const onGridTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return
    const start = touchStartRef.current
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    const threshold = 24
    if (absX < threshold && absY < threshold) return
    if (absX > absY) {
      handleDirectionChange(dx > 0 ? "RIGHT" : "LEFT")
    } else {
      handleDirectionChange(dy > 0 ? "DOWN" : "UP")
    }
    touchStartRef.current = null
  }

  const getCellClassNames = (isHead: boolean, isBody: boolean, isFood: boolean) => {
    if (isHead) {
      switch (theme) {
        case "RETRO":
          return " bg-green-500 shadow-lg border-green-400"
        case "MATRIX":
          return " bg-purple-600 shadow-lg border-purple-500"
        default:
          return " bg-blue-500 shadow-lg border-blue-400"
      }
    }
    if (isBody) {
      switch (theme) {
        case "RETRO":
          return " bg-green-400 shadow-md border-green-300"
        case "MATRIX":
          return " bg-purple-500 shadow-md border-purple-300"
        default:
          return " bg-blue-400 shadow-md border-blue-300"
      }
    }
    if (isFood) {
      switch (theme) {
        case "RETRO":
          return " bg-orange-500 shadow-lg border-orange-400"
        case "MATRIX":
          return " bg-amber-400 shadow-lg border-amber-300"
        default:
          return " bg-red-500 shadow-lg border-red-400"
      }
    }
    return " bg-gray-800/30 hover:bg-gray-700/50"
  }

  const togglePause = () => {
    if (gameState === "PLAYING") {
      setGameState("PAUSED")
    } else if (gameState === "PAUSED") {
      setGameState("PLAYING")
    }
  }

  const backToMenu = () => {
    setGameState("MENU")
    if (gameLoopRef.current) clearInterval(gameLoopRef.current)
  }

  const renderGrid = () => {
    const cells = []
    for (let y = 0; y < currentConfig.gridSize; y++) {
      for (let x = 0; x < currentConfig.gridSize; x++) {
        const isSnakeHead = snake[0]?.x === x && snake[0]?.y === y
        const isSnakeBody = snake.slice(1).some((segment) => segment.x === x && segment.y === y)
        const isFood = food.x === x && food.y === y

        const cellClass = "w-full h-full min-w-[20px] min-h-[20px] border border-secondary/50 transition-all duration-75" +
          getCellClassNames(isSnakeHead, isSnakeBody, isFood)

        cells.push(<div key={`${x}-${y}`} className={cellClass} />)
      }
    }
    return cells
  }

  if (gameState === "MENU") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 bg-card/90 backdrop-blur-sm">
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-primary flicker-slow">SNAKE GAME</h1>
            <p className="text-muted-foreground">Choose your difficulty level and speed</p>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-primary flex items-center justify-center gap-2">
                <Gauge className="w-5 h-5" />
                Game Speed
              </h3>
              <div className="flex gap-2">
                {(Object.keys(SPEED_MULTIPLIERS) as Speed[]).map((spd) => (
                  <Button
                    key={spd}
                    onClick={() => setSpeed(spd)}
                    variant={speed === spd ? "default" : "outline"}
                    className="flex-1"
                    size="sm"
                  >
                    {SPEED_MULTIPLIERS[spd].name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-primary flex items-center justify-center gap-2">
                Theme
              </h3>
              <div className="flex gap-2" role="group" aria-label="Select Theme">
                {["NEON","RETRO","MATRIX"].map((t) => (
                  <Button
                    key={t}
                    onClick={() => setTheme(t as Theme)}
                    variant={theme === (t as Theme) ? "default" : "secondary"}
                    className="flex-1 cursor-pointer"
                    size="sm"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {(Object.keys(LEVELS) as unknown as Level[]).map((lvl) => (
                <Button
                  key={lvl}
                  onClick={() => startGame(lvl)}
                  className="w-full bg-primary hover:bg-secondary text-primary-foreground hover:text-secondary-foreground transition-all duration-300"
                  size="lg"
                >
                  Level {lvl}: {LEVELS[lvl].name}
                  <span className="text-sm opacity-75 ml-2">
                    ({LEVELS[lvl].gridSize}×{LEVELS[lvl].gridSize})
                  </span>
                </Button>
              ))}
            </div>

            {highScore > 0 && (
              <div className="text-center">
                <Badge variant="secondary" className="text-lg px-4 py-2 bg-yellow-500 text-black hover:bg-green-500 hover:text-black transition-colors">
                  High Score: {highScore}
                </Badge>
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-2 md:p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-primary flicker-slow">SNAKE GAME</h1>
            <Badge variant="secondary">
              Level {level}: {currentConfig.name}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              {SPEED_MULTIPLIERS[speed].name}
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Score</div>
              <div className="text-xl font-bold text-accent">{score}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">High Score</div>
              <div className="text-xl font-bold text-chart-4">{highScore}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="border-secondary text-white hover:bg-secondary hover:text-white"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Card className="p-4 bg-card/90 backdrop-blur-sm">
              <div
                className={`grid gap-1 mx-auto aspect-square w-full max-w-[min(95vw,600px)] lg:max-w-[500px] border-4 border-primary/60 bg-background/80 shadow-2xl shadow-primary/20 ${eatFlash ? "eat-flash" : ""}`}
                style={{
                  gridTemplateColumns: `repeat(${currentConfig.gridSize}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${currentConfig.gridSize}, minmax(0, 1fr))`,
                }}
                onTouchStart={onGridTouchStart}
                onTouchEnd={onGridTouchEnd}
              >
                {renderGrid()}
              </div>
            </Card>
          </div>

          <div className="w-full lg:w-80 space-y-4">
            <Card className="p-4 bg-card/90 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex gap-2">
                  {gameState === "PLAYING" ? (
                    <Button
                      onClick={togglePause}
                      className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                  ) : gameState === "PAUSED" ? (
                    <Button
                      onClick={togglePause}
                      className="flex-1 bg-primary hover:bg-primary/80 text-primary-foreground"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      onClick={resetGame}
                      className="flex-1 bg-primary hover:bg-primary/80 text-primary-foreground"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restart
                    </Button>
                  )}
                  <Button
                    onClick={backToMenu}
                    variant="outline"
                    className="border-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground bg-transparent"
                  >
                    Menu
                  </Button>
                </div>

                {gameState === "GAME_OVER" && (
                  <div className="text-center p-4 bg-destructive/20 border border-destructive rounded-lg">
                    <h3 className="text-lg font-bold text-destructive mb-2">GAME OVER</h3>
                    <p className="text-sm text-muted-foreground">Final Score: {score}</p>
                  </div>
                )}

                {gameState === "PAUSED" && (
                  <div className="text-center p-4 bg-primary/20 border border-primary rounded-lg">
                    <h3 className="text-lg font-bold text-primary">PAUSED</h3>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4 bg-card/90 backdrop-blur-sm">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Theme</div>
                <div className="flex gap-2">
                  {(["NEON","RETRO","MATRIX"] as Theme[]).map((t) => (
                    <Button
                      key={t}
                      onClick={() => setTheme(t)}
                      variant={theme === t ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-card/90 backdrop-blur-sm">
              <div className="grid grid-cols-3 gap-2 max-w-48 mx-auto">
                <div></div>
                <Button
                  onTouchStart={() => handleDirectionChange("UP")}
                  onClick={() => handleDirectionChange("UP")}
                  className="aspect-square bg-primary hover:bg-primary/80 text-primary-foreground"
                  disabled={gameState !== "PLAYING"}
                >
                  <ChevronUp className="w-6 h-6" />
                </Button>
                <div></div>

                <Button
                  onTouchStart={() => handleDirectionChange("LEFT")}
                  onClick={() => handleDirectionChange("LEFT")}
                  className="aspect-square bg-primary hover:bg-primary/80 text-primary-foreground"
                  disabled={gameState !== "PLAYING"}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <div></div>
                <Button
                  onTouchStart={() => handleDirectionChange("RIGHT")}
                  onClick={() => handleDirectionChange("RIGHT")}
                  className="aspect-square bg-primary hover:bg-primary/80 text-primary-foreground"
                  disabled={gameState !== "PLAYING"}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>

                <div></div>
                <Button
                  onTouchStart={() => handleDirectionChange("DOWN")}
                  onClick={() => handleDirectionChange("DOWN")}
                  className="aspect-square bg-primary hover:bg-primary/80 text-primary-foreground"
                  disabled={gameState !== "PLAYING"}
                >
                  <ChevronDown className="w-6 h-6" />
                </Button>
                <div></div>
              </div>
            </Card>

            <Card className="p-4 bg-card/90 backdrop-blur-sm">
              <h3 className="font-bold text-primary mb-2">Controls</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Arrow Keys or WASD: Move</div>
                <div>Spacebar: Pause/Resume</div>
                <div>Mouse: Click direction buttons</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      <div className="text-center py-4 text-sm text-muted-foreground">Designed by: Azmat Ali</div>
    </div>
  )
}





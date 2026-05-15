import { useCallback } from 'react'

// Ref global para controlar o DiceRoller de qualquer lugar
let diceRollerControl: {
  openWithExpression: (expression: string) => void
} | null = null

export function setDiceRollerControl(control: {
  openWithExpression: (expression: string) => void
}) {
  diceRollerControl = control
}

export function useDiceRoller() {
  const rollDice = useCallback((expression: string) => {
    if (diceRollerControl) {
      diceRollerControl.openWithExpression(expression)
    }
  }, [])

  return { rollDice }
}

'use client'

import { motion } from 'framer-motion'
import { Package, Hash } from 'lucide-react'
import { RollMacro } from './RollMacro'
import type { Skill, InventoryItem } from '@/lib/types'

type SkillListProps = {
  skills: Skill[]
  expertSkills: Skill[]
}

export function SkillList({ skills, expertSkills }: SkillListProps) {
  if ((!skills || skills.length === 0) && (!expertSkills || expertSkills.length === 0)) {
    return (
      <p className="text-muted-foreground italic text-center py-4">
        Nenhuma perícia registrada.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Regular skills */}
      {skills.map((skill, index) => (
        <motion.div
          key={`skill-${skill.id ?? index}-${skill.name}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-lg bg-card/50 border border-border/40 px-3 py-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm truncate">{skill.name}</span>
            <span className="font-mono text-sm font-semibold text-primary">
              {skill.value >= 0 ? '+' : ''}{skill.value}
            </span>
          </div>
          {skill.roll_enabled && (
            <div className="mt-1.5 pt-1.5 border-t border-border/30">
              <RollMacro
                enabled={true}
                expression={skill.roll_expression || '1d20'}
                size="sm"
              />
            </div>
          )}
        </motion.div>
      ))}

      {/* Expert skills */}
      {expertSkills && expertSkills.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Especialistas
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {expertSkills.map((skill, index) => (
                <motion.div
                  key={`expert-skill-${skill.id ?? index}-${skill.name}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm truncate">{skill.name}</span>
                    <span className="font-mono text-sm font-semibold text-primary">
                      {skill.value >= 0 ? '+' : ''}{skill.value}
                    </span>
                  </div>
                  {skill.roll_enabled && (
                    <div className="mt-1.5 pt-1.5 border-t border-primary/30">
                      <RollMacro
                        enabled={true}
                        expression={skill.roll_expression || '1d20'}
                        size="sm"
                      />
                    </div>
                  )}
                </motion.div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

type InventoryListProps = {
  inventory: InventoryItem[]
}

export function InventoryList({ inventory }: InventoryListProps) {
  if (!inventory || inventory.length === 0) {
    return (
      <p className="text-muted-foreground italic text-center py-4">
        Inventário vazio.
      </p>
    )
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {inventory.map((item, i) => (
        <motion.div
          key={`item-${item.id ?? i}-${item.name}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-start gap-3 rounded-lg bg-card/50 border border-border/40 p-3"
        >
          <div className="size-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
            <Package className="size-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{item.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Hash className="size-3" />
                {item.qty}
              </span>
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {item.description}
              </p>
            )}
            {item.roll_enabled && (
              <div className="mt-2 pt-2 border-t border-border/30">
                <RollMacro
                  enabled={true}
                  expression={item.roll_expression || '1d20'}
                  size="sm"
                />
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

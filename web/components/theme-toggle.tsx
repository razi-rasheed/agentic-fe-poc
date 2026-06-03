'use client'

import * as React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun01Icon, MoonIcon, ComputerPhoneSyncIcon } from '@hugeicons/core-free-icons'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Toggle theme">
          {resolvedTheme === 'dark' ? (
            <HugeiconsIcon icon={MoonIcon} className="h-4 w-4" />
          ) : (
            <HugeiconsIcon icon={Sun01Icon} className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <HugeiconsIcon icon={Sun01Icon} className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <HugeiconsIcon icon={MoonIcon} className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <HugeiconsIcon icon={ComputerPhoneSyncIcon} className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

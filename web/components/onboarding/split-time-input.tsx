'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SplitTimeInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  className?: string
}

export function SplitTimeInput({
  label,
  value,
  onChange,
  error,
  disabled,
  className,
}: SplitTimeInputProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Input
        type="text"
        placeholder="0:00:00"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn('font-mono text-sm', error && 'border-destructive')}
        aria-label={label || undefined}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

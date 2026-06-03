import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ReviewPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Review</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Coming in the next slice.</p>
      </CardContent>
    </Card>
  )
}

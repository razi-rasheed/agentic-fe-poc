export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-6 pt-16">
      {children}
    </div>
  )
}

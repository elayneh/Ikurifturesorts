"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { GuestSelector } from "./guest-selector"
import { VariantSelector } from "./variant-selector"
import { TotalSection } from "./total-section"
import { RewardsSection } from "./rewards-section"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { ServiceDetails, ServiceVariant } from "@/types/booking"
import { useUserStore } from "@/store/userStore"
import { toast } from "sonner"

interface BookingFormProps {
  service: ServiceDetails
  userPoints: number | undefined
}

const DEFAULT_VARIANT: ServiceVariant = {
  id: "default",
  name: "Standard",
  description: "Regular booking",
  basePrice: 0,
  pointsPerGuest: 1,
  maxGuests: 2,
  priceMultiplier: 1,
  bonusPoints: 0
}

export function BookingForm({ service, userPoints }: BookingFormProps) {
  const router = useRouter()
  const [userData, setUserData] = useState<any>(null)
  console.log('sssssss',service)
  
  // Load user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('kuriftuUser')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUserData(parsedUser)
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }
  }, [])

  // Extract membership tier from user data
  const actualUser = userData?.state?.user?.user || userData?.user || userData
  const membershipTier = actualUser?.membershipTier || 'Bronze'

  const variants = service.variants && service.variants.length > 0 ? service.variants : [DEFAULT_VARIANT]

  // State
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState("")
  const [guests, setGuests] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<ServiceVariant>(variants[0])
  const [isLoading, setIsLoading] = useState(false)
  const [usePoints, setUsePoints] = useState(false)
  const [pointsToUse, setPointsToUse] = useState(0)
  const {user,token} = useUserStore();

  const maxGuests = service.maxGuests || 2

  // Calculate the number of days between dates
  const calculateDays = () => {
    if (!startDate) return 1 // Default to 1 day if no date selected
    const end = endDate || startDate
    const timeDiff = end.getTime() - startDate.getTime()
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1
  }

  // Calculate base total before any discounts
  const calculateBaseTotal = () => {
    const days = calculateDays()
    const price = selectedVariant?.basePrice || service.basePrice || 0
    return price * days * guests
  }

  // Calculate maximum allowed points discount (20% of total)
  const calculateMaxPointsDiscount = () => {
    return calculateBaseTotal() * 0.2
  }

  // Calculate final total after points discount
  const calculateTotal = () => {
    const baseTotal = calculateBaseTotal()
    if (!usePoints || pointsToUse <= 0) return baseTotal
    const pointsValue = Math.min(pointsToUse, calculateMaxPointsDiscount())
    return Math.max(0, baseTotal - pointsValue)
  }

  // Calculate reward points earned from this booking
  const calculateRewardPoints = () => {
    const days = calculateDays()
    const basePoints = service.rewardPoints || 0
    const variantBonus = selectedVariant?.bonusPoints || 0
    return Math.floor((basePoints + variantBonus) * days * guests)
  }

  // Handle points usage change
  const handlePointsChange = (use: boolean) => {
    setUsePoints(use)
    if (use) {
      const maxAllowed = Math.min(userPoints as number, calculateMaxPointsDiscount())
      setPointsToUse(maxAllowed > 0 ? maxAllowed : 0)
    } else {
      setPointsToUse(0)
    }
  }

  // Update points to use when base total changes
  useEffect(() => {
    if (usePoints) {
      const maxAllowed = Math.min(userPoints as number, calculateMaxPointsDiscount())
      setPointsToUse(prev => Math.min(prev, maxAllowed))
    }
  }, [calculateBaseTotal(), usePoints, userPoints])

  // Handle booking submission
  const handleBooking = async () => {
    if (!startDate || !selectedTime) {
      toast.error("Please select at least a start date and time")
      return
    }

    if (!token) {
      toast.error("Please log in to make a booking")
      return
    }

    setIsLoading(true)

    try {
      const bookingData = {
        serviceId: service.id,
        startDate: startDate.toISOString(),
        endDate: endDate?.toISOString() || startDate.toISOString(),
        time: selectedTime,
        guests: guests,
        variant: selectedVariant.id,
        totalPrice: calculateTotal(),
        totalPoints: calculateRewardPoints(),
      }

      const response = await fetch(`https://i-kuriftu.onrender.com/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookingData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create booking')
      }

      const data = await response.json()
      toast.success('Booking successful!')
      router.push('/dashboard')
    } catch (error) {
      console.error('Booking error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create booking. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book {service.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Selection */}
        <div className="space-y-2">
          <Label>Select Dates</Label>
          <div className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? (
                    endDate ? (
                      <>
                        {format(startDate, "LLL dd, y")} - {format(endDate, "LLL dd, y")}
                      </>
                    ) : (
                      format(startDate, "LLL dd, y")
                    )
                  ) : (
                    <span>Select date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={startDate}
                  selected={{
                    from: startDate,
                    to: endDate,
                  }}
                  onSelect={(range) => {
                    if (!range?.from) return
                    setStartDate(range.from)
                    setEndDate(range.to || range.from)
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
              </PopoverContent>
            </Popover>
          </div>
          {startDate && (
            <p className="text-sm text-muted-foreground">
              {format(startDate, "MMMM d, yyyy")} 
              {endDate && ` - ${format(endDate, "MMMM d, yyyy")}`}
              {!endDate && " (1 day)"}
            </p>
          )}
        </div>

        {/* Time Selection */}
        <div>
          <Label>Check-in Time</Label>
          <Select value={selectedTime} onValueChange={setSelectedTime}>
            <SelectTrigger>
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {["09:00 AM", "10:00 AM", "11:00 AM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"].map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Guest Selection */}
        <GuestSelector 
          guests={guests} 
          setGuests={setGuests} 
          maxGuests={maxGuests} 
        />

        {/* Variant Selection */}
        {variants.length > 1 && (
          <VariantSelector 
            variants={variants} 
            onSelect={(variant) => setSelectedVariant(variant)} 
          />
        )}

        {/* Rewards Section */}
        <RewardsSection
          usePoints={usePoints}
          setUsePoints={handlePointsChange}
          earnedPoints={calculateRewardPoints()}
          userPoints={userPoints as number}
          membershipTier={membershipTier}
          pointsToUse={pointsToUse}
          maxPointsToUse={Math.min(userPoints as number, calculateMaxPointsDiscount())}
          onPointsChange={setPointsToUse}
        />

        {/* Price Summary */}
        <div className="pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span>Base Price:</span>
            <span>${calculateBaseTotal().toFixed(2)}</span>
          </div>
          {usePoints && pointsToUse > 0 && (
            <div className="flex justify-between text-sm text-amber-600">
              <span>Points Discount:</span>
              <span>-${Math.min(pointsToUse, calculateMaxPointsDiscount()).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold mt-2">
            <span>Total Price:</span>
            <span>${calculateTotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-600 mt-2">
            <span>Points to Earn:</span>
            <span>+{calculateRewardPoints()}</span>
          </div>
        </div>

        <TotalSection
          total={calculateTotal()}
          isLoading={isLoading}
          onBook={handleBooking}
          disabled={!startDate || !selectedTime || guests < 1 || guests > maxGuests}
        />
      </CardContent>
    </Card>
  )
}
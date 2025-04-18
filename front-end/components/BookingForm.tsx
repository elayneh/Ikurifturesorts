'use client'

import { useState, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { BookingFormData, ServiceVariant, TimeSlot } from '@/types/booking'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useUserStore } from '@/store/userStore'

const serviceVariants: ServiceVariant[] = [
  {
    id: 'standard',
    name: 'Standard Resort Experience',
    description: 'Access to all basic amenities and standard rooms',
    basePrice: 200,
    pointsPerGuest: 100,
    maxGuests: 4,
    priceMultiplier: 1,
    bonusPoints: 0
  },
  {
    id: 'premium',
    name: 'Premium Resort Experience',
    description: 'Premium rooms with additional services and VIP treatment',
    basePrice: 350,
    pointsPerGuest: 200,
    maxGuests: 6,
    priceMultiplier: 1.5,
    bonusPoints: 100
  },
  {
    id: 'luxury',
    name: 'Luxury Resort Experience',
    description: 'Full luxury suite with all premium amenities and personal butler',
    basePrice: 500,
    pointsPerGuest: 300,
    maxGuests: 8,
    priceMultiplier: 2,
    bonusPoints: 200
  }
]

export default function BookingForm() {
  const router = useRouter()
  const [formData, setFormData] = useState<BookingFormData>({
    startDate: null,
    endDate: null,
    time: '',
    guests: 1,
    variant: '',
    totalPrice: 0,
    totalPoints: 0,
  })
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  const {user,token} = useUserStore();
  const [service, setService] = useState<ServiceVariant | null>(null)

  useEffect(() => {
    // Fetch user points from localStorage or API
    const userData = localStorage.getItem('userData')
    if (userData) {
      const { points } = JSON.parse(userData)
      setUserPoints(points || 0)
    }
  }, [])

  useEffect(() => {
    const fetchTimeSlots = async () => {
      try {
        const response = await fetch(`/api/bookings?date=${formData.startDate?.toISOString()}`)
        const data = await response.json()
        setAvailableTimeSlots(data.timeSlots)
      } catch (error) {
        console.error('Error fetching time slots:', error)
        // toast.error('Failed to load available time slots')
      }
    }

    if (formData.startDate) {
      fetchTimeSlots()
    }
  }, [formData.startDate])

  useEffect(() => {
    // Calculate total price and points whenever relevant fields change
    const selectedVariant = serviceVariants.find(v => v.id === formData.variant)
    if (selectedVariant) {
      const totalPrice = selectedVariant.basePrice * formData.guests
      const totalPoints = selectedVariant.pointsPerGuest * formData.guests

      setFormData(prev => ({
        ...prev,
        totalPrice,
        totalPoints
      }))
      setService(selectedVariant)
    }
  }, [formData.guests, formData.variant])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.startDate || !formData.endDate) {
      // toast.error('Please select both start and end dates')
      return
    }
    setIsLoading(true)

    try {
      const userData = localStorage.getItem('kuriftuUser')
      if (!userData) {
        // toast.error('Please log in to make a booking')
        router.push('/login')
        return
      }

      const parsedUser = JSON.parse(userData)
      const userId = parsedUser.user?._id || parsedUser._id

      const bookingData = {
        serviceId: service?.id,
        startDate: formData.startDate.toISOString(),
        endDate: formData.endDate.toISOString(),
        time: formData.time,
        guests: formData.guests,
        variant: formData.variant,
        totalPrice: formData.totalPrice,
        totalPoints: formData.totalPoints,
        userId
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/bookings`, {
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
      router.push(`/dashboard`)
    } catch (error) {
      console.error('Booking error:', error)
      // toast.error(error instanceof Error ? error.message : 'Failed to create booking. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <div>
        <h2 className="text-2xl font-bold mb-6">Book Your Resort Experience</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <DatePicker
              selected={formData.startDate}
              onChange={(date) => setFormData({ ...formData, startDate: date })}
              minDate={new Date()}
              className="w-full p-2 border rounded"
              placeholderText="Select date"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <DatePicker
              selected={formData.endDate}
              onChange={(date) => setFormData({ ...formData, endDate: date })}
              minDate={formData.startDate || new Date()}
              className="w-full p-2 border rounded"
              placeholderText="Select date"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Time</label>
            <select
              value={formData.time}
              onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            >
              <option value="">Select a time</option>
              {availableTimeSlots.map((slot) => (
                <option key={slot.time} value={slot.time} disabled={!slot.available}>
                  {slot.time} {!slot.available && '(Unavailable)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Number of Guests</label>
            <input
              type="number"
              min="1"
              max={serviceVariants.find(v => v.id === formData.variant)?.maxGuests || 4}
              value={formData.guests}
              onChange={(e) => setFormData(prev => ({ ...prev, guests: parseInt(e.target.value) }))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Experience Type</label>
            <div className="mt-2 space-y-4">
              {serviceVariants.map((variant) => (
                <div key={variant.id} className="flex items-center">
                  <input
                    type="radio"
                    id={variant.id}
                    name="variant"
                    value={variant.id}
                    checked={formData.variant === variant.id}
                    onChange={(e) => setFormData(prev => ({ ...prev, variant: e.target.value }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor={variant.id} className="ml-3">
                    <div className="text-sm font-medium text-gray-900">{variant.name}</div>
                    <div className="text-sm text-gray-500">{variant.description}</div>
                    <div className="text-sm text-gray-700">
                      Base price: ${variant.basePrice} | Points per guest: {variant.pointsPerGuest}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Price:</span>
              <span className="text-lg font-bold text-gray-900">${formData.totalPrice}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm font-medium text-gray-700">Points to Earn:</span>
              <span className="text-lg font-bold text-green-600">+{formData.totalPoints}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm font-medium text-gray-700">Your Current Points:</span>
              <span className="text-lg font-bold text-blue-600">{userPoints}</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
        >
          {isLoading ? 'Processing...' : 'Confirm Booking'}
        </button>
      </div>
    </form>
  )
} 
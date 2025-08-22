import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 GET /api/admin/visitors/analytics - Route hit!')
    
    // Get session for authentication
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login to view analytics' },
        { status: 401 }
      )
    }

    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'

    console.log('🔍 Admin fetching visitor analytics from backend...')

    // Fetch analytics from the backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
    console.log('🔍 Backend URL:', backendUrl)
    console.log('🔍 Full URL:', `${backendUrl}/api/visitors/analytics?period=${period}`)
    
    const response = await fetch(`${backendUrl}/api/visitors/analytics?period=${period}`)
    
    console.log('🔍 Backend response status:', response.status)
    console.log('🔍 Backend response ok:', response.ok)

    if (!response.ok) {
      console.error('❌ Backend API error:', response.status, response.statusText)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch analytics from backend',
        details: `Backend returned ${response.status}: ${response.statusText}`
      }, { status: 500 })
    }

    const backendData = await response.json()
    console.log('🔍 Backend response data:', JSON.stringify(backendData, null, 2))
    
    if (!backendData.success) {
      console.error('❌ Backend returned error:', backendData)
      return NextResponse.json({
        success: false,
        error: 'Backend returned error',
        details: backendData.message || 'Unknown backend error'
      }, { status: 500 })
    }

    console.log('✅ Visitor analytics fetched successfully from backend')

    return NextResponse.json({
      success: true,
      data: backendData.data,
      source: 'backend'
    })

  } catch (error) {
    console.error('❌ Admin visitor analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error - failed to fetch analytics' },
      { status: 500 }
    )
  }
}

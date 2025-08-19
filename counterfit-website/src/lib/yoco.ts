// Yoco configuration
export const YOCO_CONFIG = {
  publicKey: process.env.NEXT_PUBLIC_YOCO_PUBLIC_KEY || '',
  secretKey: process.env.YOCO_SECRET_KEY || '',
  webhookSecret: process.env.YOCO_WEBHOOK_SECRET || '',
  currency: 'ZAR',
  name: 'Counterfit',
  description: 'Luxury Streetwear'
}

// Generate order number
export const generateOrderNumber = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `ORD-${year}${month}-${random}`
}

// Generate tracking number
export const generateTrackingNumber = () => {
  const prefix = 'CF'
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  const suffix = 'SA'
  return `${prefix}${random}${suffix}`
}

// Create YOCO checkout using the Checkout API
// Note: amount should be in cents (smallest currency unit)
// e.g., R23.50 should be sent as 2350
export async function createYocoCheckout(checkoutData: {
  amount: number // Amount in cents (e.g., 2350 for R23.50)
  currency: string
  metadata: {
    orderId: string
    orderNumber: string
    customerEmail: string
    customerName?: string
  }
  successUrl?: string
  cancelUrl?: string
}) {
  try {
    console.log('💳 Creating Yoco checkout:', checkoutData)
    
    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_CONFIG.secretKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `${checkoutData.metadata.orderId}-${Date.now()}`
      },
      body: JSON.stringify({
        amount: checkoutData.amount,
        currency: checkoutData.currency,
        metadata: checkoutData.metadata,
        successUrl: checkoutData.successUrl,
        cancelUrl: checkoutData.cancelUrl
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Yoco checkout creation failed: ${errorData.message || response.statusText}`)
    }
    
    const checkout = await response.json()
    console.log('✅ Yoco checkout created:', checkout)
    
    return checkout
    
  } catch (error) {
    console.error('❌ Failed to create Yoco checkout:', error)
    throw error
  }
}

// Register webhook endpoint with YOCO
export async function registerYocoWebhook(webhookUrl: string) {
  try {
    console.log('🔔 Registering Yoco webhook:', webhookUrl)
    
    const response = await fetch('https://payments.yoco.com/api/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_CONFIG.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Webhook registration failed: ${errorData.message || response.statusText}`)
    }
    
    const webhook = await response.json()
    console.log('✅ Yoco webhook registered:', webhook)
    
    return webhook
    
  } catch (error) {
    console.error('❌ Failed to register Yoco webhook:', error)
    throw error
  }
}

// Verify webhook signature using the new YOCO webhook security standard
export function verifyWebhookSignature(
  webhookId: string,
  webhookTimestamp: string,
  requestBody: string,
  webhookSignature: string
): boolean {
  try {
    if (!YOCO_CONFIG.webhookSecret) {
      console.warn('⚠️ Missing webhook secret')
      return false
    }

    // Construct the signed content: id.timestamp.body
    const signedContent = `${webhookId}.${webhookTimestamp}.${requestBody}`
    
    // Remove the 'whsec_' prefix from the secret
    const secretBytes = Buffer.from(YOCO_CONFIG.webhookSecret.split('_')[1], 'base64')
    
    // Generate expected signature using HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64')
    
    // Extract the signature from the webhook-signature header
    // Format: "v1,signature" or "v1,signature v2,another-signature"
    const signatures = webhookSignature.split(' ')
    const primarySignature = signatures[0].split(',')[1]
    
    // Use constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(primarySignature)
    )
    
    console.log('🔐 Webhook signature verification:', isValid ? '✅ Valid' : '❌ Invalid')
    return isValid
    
  } catch (error) {
    console.error('❌ Webhook signature verification error:', error)
    return false
  }
}

// Validate webhook timestamp to prevent replay attacks
export function validateWebhookTimestamp(timestamp: string, thresholdMinutes: number = 3): boolean {
  try {
    const webhookTime = parseInt(timestamp) * 1000 // Convert to milliseconds
    const currentTime = Date.now()
    const thresholdMs = thresholdMinutes * 60 * 1000
    
    const isValid = Math.abs(currentTime - webhookTime) <= thresholdMs
    
    console.log('⏰ Webhook timestamp validation:', isValid ? '✅ Valid' : '❌ Invalid')
    return isValid
    
  } catch (error) {
    console.error('❌ Webhook timestamp validation error:', error)
    return false
  }
}

// Yoco payment interface
export interface YocoPaymentData {
  id: string
  amount: number
  currency: string
  metadata: {
    orderId: string
    orderNumber: string
    customerEmail: string
  }
}

// Yoco checkout interface
export interface YocoCheckoutData {
  id: string
  redirectUrl: string
  amount: number
  currency: string
  metadata: any
  status: string
}

// Initialize Yoco popup (will be loaded from CDN)
export const initializeYoco = (callback: (result: any) => void) => {
  return new Promise((resolve, reject) => {
    // Debug logging
    console.log('🔍 Yoco Config:', YOCO_CONFIG)
    console.log('🔍 Public Key:', process.env.NEXT_PUBLIC_YOCO_PUBLIC_KEY)
    console.log('🔍 Window object:', typeof window)
    
    // Check if Yoco is already loaded
    if (typeof window !== 'undefined' && (window as any).Yoco) {
      console.log('✅ Yoco already loaded, using existing instance')
      const yoco = new (window as any).Yoco({
        publicKey: YOCO_CONFIG.publicKey
      })
      resolve(yoco)
      return
    }
    
    // Check if script is already being loaded
    if ((window as any).yocoScriptLoading) {
      console.log('⏳ Yoco script already loading, waiting...')
      const checkInterval = setInterval(() => {
        if ((window as any).Yoco) {
          clearInterval(checkInterval)
          console.log('✅ Yoco loaded after waiting')
          const yoco = new (window as any).Yoco({
            publicKey: YOCO_CONFIG.publicKey
          })
          resolve(yoco)
        }
      }, 100)
      return
    }
    
    // Load Yoco script
    console.log('📥 Loading Yoco script...')
    ;(window as any).yocoScriptLoading = true
    
    const script = document.createElement('script')
    script.src = 'https://js.yoco.com/sdk/v1/checkout.js'
    script.async = true
    
    script.onload = () => {
      console.log('✅ Yoco script loaded successfully')
      ;(window as any).yocoScriptLoading = false
      
      // Wait a bit for Yoco to initialize
      setTimeout(() => {
        if ((window as any).Yoco) {
          const yoco = new (window as any).Yoco({
            publicKey: YOCO_CONFIG.publicKey
          })
          resolve(yoco)
        } else {
          reject(new Error('Yoco object not found after script load'))
        }
      }, 100)
    }
    
    script.onerror = (error) => {
      console.error('❌ Failed to load Yoco script:', error)
      console.error('❌ Script URL attempted:', 'https://js.yoco.com/sdk/v1/checkout.js')
      console.error('❌ Network error details:', error)
      ;(window as any).yocoScriptLoading = false
      
      // Check if it's a network error or missing environment variable
      if (!YOCO_CONFIG.publicKey) {
        reject(new Error('Yoco public key not configured. Please check NEXT_PUBLIC_YOCO_PUBLIC_KEY environment variable.'))
      } else {
        reject(new Error('Failed to load Yoco script. Please check your internet connection and try again.'))
      }
    }
    
    document.head.appendChild(script)
  })
}

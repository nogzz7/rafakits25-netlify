const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // CORS headers para Netlify
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { line_items, customer_email, customer_name = 'Cliente Rafakits25' } = JSON.parse(event.body);

    console.log('🛒 Processando checkout no Netlify:', { 
      items_count: line_items?.length,
      customer_email 
    });

    if (!line_items || line_items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Carrinho vazio. Adicione produtos antes do checkout.' 
        })
      };
    }

    // Criar sessão de checkout no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: line_items,
      mode: 'payment',
      success_url: `${process.env.URL || 'https://rafakits25.netlify.app'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://rafakits25.netlify.app'}/cancel.html`,
      customer_email: customer_email,
      locale: 'pt-BR',
      shipping_address_collection: { 
        allowed_countries: ['BR'] 
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'brl' },
            display_name: 'Frete grátis',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 10 }
            }
          }
        }
      ],
      metadata: {
        store: 'Rafakits25',
        customer_name: customer_name,
        environment: 'production'
      }
    });

    console.log('✅ Checkout session criada:', session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        id: session.id,
        url: session.url,
        type: 'stripe'
      })
    };

  } catch (error) {
    console.error('❌ Erro no Stripe:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erro no processamento do pagamento. Tente novamente.'
      })
    };
  }
};
const stripe = require('stripe')('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');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { line_items, customer_email } = JSON.parse(event.body);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'boleto'],
      line_items,
      mode: 'payment',
      success_url: `${event.headers.origin}/success.html`,
      cancel_url: `${event.headers.origin}/cancel.html`,
      customer_email,
      locale: 'pt-BR'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id, url: session.url })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
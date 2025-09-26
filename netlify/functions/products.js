const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Cache em memória para otimização
let productsCache = null;
let cacheTime = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutos

// Função para normalizar dados do produto
function normalizeProductData(stripeProduct) {
  const defaultPrice = stripeProduct.default_price;
  const metadata = stripeProduct.metadata || {};
  
  let price = 0;
  let stripePriceId = null;
  
  if (defaultPrice && typeof defaultPrice === 'object') {
    price = defaultPrice.unit_amount / 100;
    stripePriceId = defaultPrice.id;
  }

  const image = stripeProduct.images && stripeProduct.images.length > 0 
    ? stripeProduct.images[0] 
    : '/imagem/placeholder.jpg';

  // Lógica para determinar a coleção
  const nameLower = (stripeProduct.name || "").toLowerCase();
  let collection = 'destaques';
  
  const collectionMap = {
    'camiseta': 'camisetas', 'camisetas': 'camisetas', 'tshirt': 'camisetas',
    'moletom': 'moletons', 'hoodie': 'moletons', 'blusa': 'moletons',
    'boné': 'bones', 'bone': 'bones', 'hat': 'bones',
    'tênis': 'tenis', 'tenis': 'tenis', 'sneaker': 'tenis',
    'acessório': 'acessorios', 'acessorio': 'acessorios',
    'kit': 'kits', 'combo': 'kits', 'pack': 'kits'
  };

  for (const [keyword, coll] of Object.entries(collectionMap)) {
    if (nameLower.includes(keyword)) {
      collection = coll;
      break;
    }
  }

  return {
    id: stripeProduct.id,
    name: stripeProduct.name,
    description: stripeProduct.description || 'Produto premium da Rafakits25 Streetwear',
    image: image,
    price: price,
    stripePriceId: stripePriceId,
    collection: metadata.collection || collection,
    featured: metadata.featured === 'true' || metadata.destaque === 'true',
    sizes: metadata.sizes ? metadata.sizes.split(',').map(s => s.trim()) : ['Único'],
    colors: metadata.colors ? metadata.colors.split(',').map(c => c.trim()) : ['Padrão'],
    gender: metadata.gender || 'unissex',
    inStock: metadata.stock !== '0',
    rating: metadata.rating ? parseFloat(metadata.rating) : (4 + Math.random()).toFixed(1),
    reviewCount: metadata.review_count ? parseInt(metadata.review_count) : Math.floor(Math.random() * 50) + 10
  };
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { collection, featured, refresh } = event.queryStringParameters || {};

    console.log('📦 Buscando produtos do Stripe:', { collection, featured, refresh });

    // Usar cache se disponível e não for refresh
    if (!refresh && productsCache && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
      let filteredProducts = [...productsCache];
      
      if (collection) {
        filteredProducts = filteredProducts.filter(p => p.collection === collection);
      }
      if (featured === 'true') {
        filteredProducts = filteredProducts.filter(p => p.featured);
      }

      console.log('⚡ Retornando produtos do cache:', filteredProducts.length);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          products: filteredProducts,
          fromCache: true,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Buscar produtos do Stripe
    const stripeProducts = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ['data.default_price']
    });

    console.log('✅ Produtos encontrados no Stripe:', stripeProducts.data.length);

    // Processar e filtrar produtos
    const processedProducts = stripeProducts.data
      .map(normalizeProductData)
      .filter(p => p.stripePriceId && p.price > 0 && p.inStock !== false);

    // Atualizar cache
    productsCache = processedProducts;
    cacheTime = Date.now();

    let filteredProducts = processedProducts;
    if (collection) {
      filteredProducts = filteredProducts.filter(p => p.collection === collection);
    }
    if (featured === 'true') {
      filteredProducts = filteredProducts.filter(p => p.featured);
    }

    console.log('📊 Produtos filtrados:', filteredProducts.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        products: filteredProducts,
        total: filteredProducts.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Erro ao buscar produtos:', error);
    
    // Fallback para cache em caso de erro
    if (productsCache) {
      console.log('🔄 Usando cache como fallback');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          products: productsCache,
          fromCache: true,
          fallback: true,
          error: 'Usando dados em cache devido a erro de conexão'
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erro ao carregar produtos do Stripe'
      })
    };
  }
};
/**
 * NovaGadgetry - Shopify Storefront API Integration
 * Utilise l'API GraphQL Storefront pour gérer les produits et le checkout
 */

const ShopifyStorefront = {
  // Configuration Shopify
  config: {
    storeDomain: 'novagadgetry-3.myshopify.com',
    storefrontAccessToken: '17b5e9148ecf9d56db3abd9b8310cb86',
    apiVersion: '2024-01'
  },

  // Mapping des produits locaux vers les handles Shopify
  productHandles: {
    'ecouteurs-bluetooth': 'ecouteurs-bluetooth',
    'trepied-flexible-universel': 'trepied-flexible-universel',
    'nettoyeur-ecran': 'nettoyeur-ecran',
    'ventilateur-usb-portable': 'ventilateur-usb-portable'
  },

  /**
   * Effectue une requête GraphQL vers l'API Storefront
   */
  async graphqlRequest(query, variables = {}) {
    const url = `https://${this.config.storeDomain}/api/${this.config.apiVersion}/graphql.json`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.config.storefrontAccessToken
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        console.error('GraphQL Errors:', data.errors);
        throw new Error(data.errors[0].message);
      }

      return data.data;
    } catch (error) {
      console.error('Shopify API Error:', error);
      throw error;
    }
  },

  /**
   * Récupère un produit par son handle
   */
  async getProductByHandle(handle) {
    const query = `
      query getProduct($handle: String!) {
        product(handle: $handle) {
          id
          title
          description
          descriptionHtml
          handle
          tags
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                availableForSale
                quantityAvailable
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest(query, { handle });
    return data.product;
  },

  /**
   * Récupère tous les produits avec leur stock
   */
  async getAllProducts() {
    const query = `
      query getAllProducts {
        products(first: 50) {
          edges {
            node {
              id
              title
              handle
              description
              tags
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price {
                      amount
                      currencyCode
                    }
                    availableForSale
                    quantityAvailable
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest(query);
    return data.products.edges.map(edge => edge.node);
  },

  /**
   * Récupère les produits best-sellers (tag: best-seller)
   */
  async getBestSellers(limit = 6) {
    const query = `
      query getBestSellers {
        products(first: 50, query: "tag:best-seller") {
          edges {
            node {
              id
              title
              handle
              description
              tags
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    price {
                      amount
                      currencyCode
                    }
                    availableForSale
                    quantityAvailable
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest(query);
    return data.products.edges.map(edge => edge.node).slice(0, limit);
  },

  /**
   * Crée un checkout avec les produits sélectionnés
   */
  async createCheckout(variantId, quantity) {
    const query = `
      mutation createCheckout($input: CheckoutCreateInput!) {
        checkoutCreate(input: $input) {
          checkout {
            id
            webUrl
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }
          }
          checkoutUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        lineItems: [{
          variantId: variantId,
          quantity: parseInt(quantity)
        }]
      }
    };

    const data = await this.graphqlRequest(query, variables);
    
    if (data.checkoutCreate.checkoutUserErrors.length > 0) {
      throw new Error(data.checkoutCreate.checkoutUserErrors[0].message);
    }

    return data.checkoutCreate.checkout;
  },

  /**
   * Crée un panier (Cart API - plus récente)
   */
  async createCart(variantId, quantity) {
    const query = `
      mutation createCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 10) {
              edges {
                node {
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      title
                    }
                  }
                }
              }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        lines: [{
          merchandiseId: variantId,
          quantity: parseInt(quantity)
        }]
      }
    };

    const data = await this.graphqlRequest(query, variables);
    
    if (data.cartCreate.userErrors && data.cartCreate.userErrors.length > 0) {
      throw new Error(data.cartCreate.userErrors[0].message);
    }

    return data.cartCreate.cart;
  },

  /**
   * Crée un panier avec plusieurs articles
   */
  async createCartWithItems(items) {
    const query = `
      mutation createCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            lines(first: 50) {
              edges {
                node {
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      title
                    }
                  }
                }
              }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        lines: items.map(item => ({
          merchandiseId: item.variantId,
          quantity: parseInt(item.quantity)
        }))
      }
    };

    const data = await this.graphqlRequest(query, variables);
    
    if (data.cartCreate.userErrors && data.cartCreate.userErrors.length > 0) {
      throw new Error(data.cartCreate.userErrors[0].message);
    }

    return data.cartCreate.cart;
  },

  /**
   * Formate le prix pour l'affichage
   */
  formatPrice(amount, currency = 'CAD') {
    return parseFloat(amount).toFixed(2) + '$ ' + currency;
  },

  /**
   * Génère le HTML pour l'indicateur de stock
   */
  getStockIndicatorHTML(quantity, availableForSale) {
    if (!availableForSale || quantity <= 0) {
      return `
        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
          <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
          </svg>
          Rupture de stock
        </span>
      `;
    } else if (quantity <= 5) {
      return `
        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
          </svg>
          Plus que ${quantity} en stock
        </span>
      `;
    } else {
      return `
        <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          ${quantity} articles en stock
        </span>
      `;
    }
  },

  /**
   * Génère un badge de stock compact pour les listes
   */
  getStockBadgeHTML(quantity, availableForSale) {
    if (!availableForSale || quantity <= 0) {
      return `<span class="text-xs font-medium text-red-600">Rupture de stock</span>`;
    } else if (quantity <= 5) {
      return `<span class="text-xs font-medium text-yellow-600">Plus que ${quantity} en stock</span>`;
    } else {
      return `<span class="text-xs font-medium text-green-600">${quantity} en stock</span>`;
    }
  }
};

/**
 * NovaGadgetry - Système de Panier avec localStorage
 */
const NovaCart = {
  STORAGE_KEY: 'novagadgetry_cart',

  /**
   * Récupère le panier depuis localStorage
   */
  getCart() {
    try {
      const cart = localStorage.getItem(this.STORAGE_KEY);
      return cart ? JSON.parse(cart) : [];
    } catch (e) {
      console.error('Erreur lecture panier:', e);
      return [];
    }
  },

  /**
   * Sauvegarde le panier dans localStorage
   */
  saveCart(cart) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
      this.updateCartBadge();
      this.dispatchCartEvent();
    } catch (e) {
      console.error('Erreur sauvegarde panier:', e);
    }
  },

  /**
   * Ajoute un article au panier
   */
  addItem(item) {
    const cart = this.getCart();
    const existingIndex = cart.findIndex(i => i.variantId === item.variantId);
    
    if (existingIndex > -1) {
      cart[existingIndex].quantity += item.quantity;
    } else {
      cart.push({
        variantId: item.variantId,
        productId: item.productId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        handle: item.handle
      });
    }
    
    this.saveCart(cart);
    return cart;
  },

  /**
   * Met à jour la quantité d'un article
   */
  updateQuantity(variantId, quantity) {
    const cart = this.getCart();
    const index = cart.findIndex(i => i.variantId === variantId);
    
    if (index > -1) {
      if (quantity <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].quantity = quantity;
      }
      this.saveCart(cart);
    }
    return cart;
  },

  /**
   * Supprime un article du panier
   */
  removeItem(variantId) {
    const cart = this.getCart().filter(i => i.variantId !== variantId);
    this.saveCart(cart);
    return cart;
  },

  /**
   * Vide le panier
   */
  clearCart() {
    this.saveCart([]);
    return [];
  },

  /**
   * Compte le nombre total d'articles
   */
  getItemCount() {
    return this.getCart().reduce((total, item) => total + item.quantity, 0);
  },

  /**
   * Calcule le total du panier
   */
  getTotal() {
    return this.getCart().reduce((total, item) => total + (item.price * item.quantity), 0);
  },

  /**
   * Met à jour le badge du panier dans le header
   */
  updateCartBadge() {
    const count = this.getItemCount();
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  /**
   * Émet un événement personnalisé pour notifier les changements
   */
  dispatchCartEvent() {
    window.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: { cart: this.getCart(), count: this.getItemCount(), total: this.getTotal() }
    }));
  },

  /**
   * Crée un checkout Shopify avec tous les articles du panier
   */
  async checkout() {
    const cart = this.getCart();
    if (cart.length === 0) {
      alert('Votre panier est vide');
      return null;
    }

    try {
      const shopifyCart = await ShopifyStorefront.createCartWithItems(
        cart.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity
        }))
      );

      if (shopifyCart && shopifyCart.checkoutUrl) {
        window.location.href = shopifyCart.checkoutUrl;
      }
      return shopifyCart;
    } catch (error) {
      console.error('Erreur checkout:', error);
      throw error;
    }
  },

  /**
   * Génère le HTML du mini-panier dropdown
   */
  getMiniCartHTML() {
    const cart = this.getCart();
    const total = this.getTotal();
    
    if (cart.length === 0) {
      return `
        <div class="p-6 text-center">
          <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
          <p class="text-gray-500">Votre panier est vide</p>
          <a href="catalogue.html" class="mt-4 inline-block text-blue-600 hover:underline font-medium">Voir le catalogue</a>
        </div>
      `;
    }

    const itemsHTML = cart.map(item => `
      <div class="flex items-center gap-3 py-3 border-b border-gray-100">
        <img src="${item.image || 'https://lh3.googleusercontent.com/33Blywbs-uennH1cfGAaz0TMPxpqB0zU4r5FLDpn-q1ONwSjNKeV9Kl93exr9ITP1bfdmFn7_UvlCqqj6fnut40Zctro9lSlFYwKz9Y=w1064-v0'}" alt="${item.title}" class="w-14 h-14 object-contain rounded-lg bg-gray-50">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">${item.title}</p>
          <p class="text-sm text-gray-500">${item.quantity} × ${item.price.toFixed(2)}$</p>
        </div>
        <button onclick="NovaCart.removeItem('${item.variantId}'); renderMiniCart();" class="text-gray-400 hover:text-red-500 p-1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `).join('');

    return `
      <div class="max-h-80 overflow-y-auto px-4">
        ${itemsHTML}
      </div>
      <div class="p-4 border-t border-gray-200 bg-gray-50">
        <div class="flex justify-between items-center mb-4">
          <span class="font-semibold text-gray-900">Total</span>
          <span class="font-bold text-blue-600">${total.toFixed(2)}$ CAD</span>
        </div>
        <button onclick="NovaCart.checkout()" class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
          Passer commande
        </button>
        <button onclick="NovaCart.clearCart(); renderMiniCart();" class="w-full mt-2 text-sm text-gray-500 hover:text-red-500">
          Vider le panier
        </button>
      </div>
    `;
  },

  /**
   * Initialise le panier au chargement de la page
   */
  init() {
    this.updateCartBadge();
  }
};

// Fonction globale pour rendre le mini-panier
function renderMiniCart() {
  const container = document.getElementById('mini-cart-content');
  if (container) {
    container.innerHTML = NovaCart.getMiniCartHTML();
  }
}

// Initialiser le panier au chargement
document.addEventListener('DOMContentLoaded', () => {
  NovaCart.init();
});

// Export pour utilisation dans les modules ES6 (optionnel)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ShopifyStorefront, NovaCart };
}

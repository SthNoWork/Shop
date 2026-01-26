// ============================================================================
// Shop - Product Catalog Browser (GitHub Pages ready!)
// Read-only product display with search, category filtering, and product modal
// ============================================================================

import Database from './connection/database.js';

// Initialize database connection
const db = new Database('products');

// ─── State Management ────────────────────────────────────────────────────────
let allProducts = [];
let selectedCategories = new Set();

// ─── DOM Elements ────────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const categoryFilters = document.getElementById('categoryFilters');
const productsGrid = document.getElementById('productsGrid');
const recentProducts = document.getElementById('recentProducts');
const popularProducts = document.getElementById('popularProducts');
const productCount = document.getElementById('productCount');
const productModal = document.getElementById('productModal');
const modalBody = document.getElementById('modalBody');

// ─── Initialize ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    await loadCategories();
    setupSearchListener();
    setupKeyboardListener();
});

// ─── Load Categories ─────────────────────────────────────────────────────────
async function loadCategories() {
    try {
        const categories = await db.getUniqueCategories();
        
        if (categories.length === 0) {
            categoryFilters.innerHTML = '<p class="no-data">No categories available</p>';
            return;
        }

        categoryFilters.innerHTML = categories.map(category => `
            <label class="category-checkbox">
                <input 
                    type="checkbox" 
                    value="${escapeHtml(category)}" 
                    data-category="${escapeHtml(category)}"
                >
                <span>${escapeHtml(category)}</span>
            </label>
        `).join('');

        // Add event listeners to checkboxes
        categoryFilters.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', handleCategoryChange);
        });

    } catch (err) {
        categoryFilters.innerHTML = `<p class="error">Failed to load categories: ${err.message}</p>`;
    }
}

// ─── Load Products ───────────────────────────────────────────────────────────
async function loadProducts() {
    productsGrid.innerHTML = '<p class="loading">Loading products...</p>';
    recentProducts.innerHTML = '<p class="loading">Loading...</p>';
    popularProducts.innerHTML = '<p class="loading">Loading...</p>';
    
    try {
        allProducts = await db.selectAll();
        
        // Render all sections
        renderRecentProducts();
        renderPopularProducts();
        renderProducts(allProducts);
    } catch (err) {
        productsGrid.innerHTML = `<p class="error">Failed to load products: ${err.message}</p>`;
        recentProducts.innerHTML = `<p class="error">Failed to load</p>`;
        popularProducts.innerHTML = `<p class="error">Failed to load</p>`;
    }
}

// ─── Render Recent Products (last 8 by created_at) ───────────────────────────
function renderRecentProducts() {
    const recent = [...allProducts]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8);
    
    if (recent.length === 0) {
        recentProducts.innerHTML = '<p class="no-data">No products yet</p>';
        return;
    }
    
    recentProducts.innerHTML = recent.map(product => renderProductCard(product, true)).join('');
}

// ─── Render Popular Products (top 8 by click_count) ──────────────────────────
function renderPopularProducts() {
    const popular = [...allProducts]
        .filter(p => (p.click_count || 0) > 0)
        .sort((a, b) => (b.click_count || 0) - (a.click_count || 0))
        .slice(0, 8);
    
    if (popular.length === 0) {
        popularProducts.innerHTML = '<p class="no-data">No popular products yet</p>';
        return;
    }
    
    popularProducts.innerHTML = popular.map(product => renderProductCard(product, true)).join('');
}

// ─── Category Filter Handler ────────────────────────────────────────────────
function handleCategoryChange(e) {
    const category = e.target.value;
    
    if (e.target.checked) {
        selectedCategories.add(category);
    } else {
        selectedCategories.delete(category);
    }
    
    filterProducts();
}

// ─── Search Handler ──────────────────────────────────────────────────────────
function setupSearchListener() {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            filterProducts();
        }, 300);
    });
}

// ─── Keyboard Handler (ESC to close modal) ───────────────────────────────────
function setupKeyboardListener() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && productModal.classList.contains('active')) {
            closeModal();
        }
    });
}

// ─── Filter & Render Products ────────────────────────────────────────────────
function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    let filtered = allProducts;
    
    // Filter by categories (products must have ALL selected categories)
    if (selectedCategories.size > 0) {
        filtered = filtered.filter(product => {
            if (!product.categories || !Array.isArray(product.categories)) {
                return false;
            }
            return Array.from(selectedCategories).every(cat => 
                product.categories.includes(cat)
            );
        });
    }
    
    // Filter by search term (searches in title and description)
    if (searchTerm) {
        filtered = filtered.filter(product => {
            const title = (product.title || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            return title.includes(searchTerm) || description.includes(searchTerm);
        });
    }
    
    renderProducts(filtered);
}

// ─── Render Single Product Card ──────────────────────────────────────────────
function renderProductCard(product, compact = false) {
    // Handle multiple images
    const images = Array.isArray(product.image_urls) && product.image_urls.length > 0
        ? product.image_urls
        : (product.image_url ? [product.image_url] : []);
    
    const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/400x400?text=No+Image';
    
    // Check if first item is video
    const isVideo = mainImage.includes('.mp4') || mainImage.includes('.webm');
    
    const price = product.price 
        ? `<p class="price">$${parseFloat(product.price).toFixed(2)}</p>`
        : '';
    
    const mediaCount = images.length > 1 ? `<span class="image-count-badge">${images.length}</span>` : '';
    
    const mediaElement = isVideo 
        ? `<video src="${escapeHtml(mainImage)}" muted loop></video>`
        : `<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.title)}" onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">`;
    
    return `
        <div class="product-card ${compact ? 'compact' : ''}" onclick="openProductModal('${product.id}')" data-id="${product.id}">
            <div class="product-image">
                ${mediaElement}
                ${mediaCount}
            </div>
            <div class="product-info">
                <h3 class="product-title">${escapeHtml(product.title)}</h3>
                ${price}
            </div>
        </div>
    `;
}

// ─── Render Products Grid ────────────────────────────────────────────────────
function renderProducts(products) {
    productCount.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
    
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="no-data">No products found</p>';
        return;
    }
    
    productsGrid.innerHTML = products.map(product => renderProductCard(product)).join('');
}

// ─── Open Product Modal ──────────────────────────────────────────────────────
window.openProductModal = async function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    // Track click (increment click_count)
    trackProductClick(productId);
    
    // Handle multiple images
    const images = Array.isArray(product.image_urls) && product.image_urls.length > 0
        ? product.image_urls
        : (product.image_url ? [product.image_url] : []);
    
    const mainMedia = images.length > 0 ? images[0] : 'https://via.placeholder.com/400x400?text=No+Image';
    const isVideo = mainMedia.includes('.mp4') || mainMedia.includes('.webm');
    
    const categories = product.categories && Array.isArray(product.categories) 
        ? product.categories.map(cat => `<span class="tag">${escapeHtml(cat)}</span>`).join('')
        : '';
    
    const price = product.price 
        ? `<p class="modal-price">$${parseFloat(product.price).toFixed(2)}</p>`
        : '';
    
    const description = product.description 
        ? `<p class="modal-description">${escapeHtml(product.description)}</p>`
        : '';
    
    const adminNotes = product.admin_notes 
        ? `<div class="modal-notes"><strong>Note:</strong> ${escapeHtml(product.admin_notes)}</div>`
        : '';
    
    // Main media display
    const mainMediaHtml = isVideo 
        ? `<video id="modalMainMedia" src="${escapeHtml(mainMedia)}" controls autoplay loop class="modal-main-media"></video>`
        : `<img id="modalMainMedia" src="${escapeHtml(mainMedia)}" alt="${escapeHtml(product.title)}" class="modal-main-media">`;
    
    // Gallery thumbnails (only if multiple media)
    const galleryHtml = images.length > 1 
        ? `<div class="modal-gallery">
            ${images.map((img, idx) => {
                const isVid = img.includes('.mp4') || img.includes('.webm');
                return isVid 
                    ? `<div class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="changeModalMedia('${escapeHtml(img)}', this, true)">
                         <video src="${escapeHtml(img)}" muted></video>
                         <span class="video-icon">▶</span>
                       </div>`
                    : `<img src="${escapeHtml(img)}" class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="changeModalMedia('${escapeHtml(img)}', this, false)">`;
            }).join('')}
           </div>`
        : '';
    
    modalBody.innerHTML = `
        <div class="modal-grid">
            <div class="modal-media-section">
                ${mainMediaHtml}
                ${galleryHtml}
            </div>
            <div class="modal-info-section">
                <h2 class="modal-title">${escapeHtml(product.title)}</h2>
                ${price}
                ${description}
                <div class="modal-categories">${categories}</div>
                ${adminNotes}
                <p class="modal-views">👁 ${product.click_count || 0} views</p>
            </div>
        </div>
    `;
    
    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

// ─── Change Modal Media ──────────────────────────────────────────────────────
window.changeModalMedia = function(src, thumb, isVideo) {
    const container = document.querySelector('.modal-media-section');
    const oldMedia = document.getElementById('modalMainMedia');
    
    // Remove active from all thumbs
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    
    // Replace media element
    if (isVideo) {
        const video = document.createElement('video');
        video.id = 'modalMainMedia';
        video.src = src;
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.className = 'modal-main-media';
        oldMedia.replaceWith(video);
    } else {
        const img = document.createElement('img');
        img.id = 'modalMainMedia';
        img.src = src;
        img.className = 'modal-main-media';
        oldMedia.replaceWith(img);
    }
};

// ─── Close Modal ─────────────────────────────────────────────────────────────
window.closeModal = function(event) {
    if (event && event.target !== productModal) return;
    productModal.classList.remove('active');
    document.body.style.overflow = '';
};

// ─── Track Product Click ─────────────────────────────────────────────────────
async function trackProductClick(productId) {
    try {
        // Use anon key - requires RLS policy to allow update on click_count
        const response = await fetch(
            `https://awgairewlkuwxsvfxaqq.supabase.co/rest/v1/rpc/increment_click_count`,
            {
                method: 'POST',
                headers: {
                    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3Z2FpcmV3bGt1d3hzdmZ4YXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxOTE0NDQsImV4cCI6MjA2NDc2NzQ0NH0.DjTHECIQQCWIjvx5Awp7IzBP3qcHoTkguHy4S8Yovh4',
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3Z2FpcmV3bGt1d3hzdmZ4YXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxOTE0NDQsImV4cCI6MjA2NDc2NzQ0NH0.DjTHECIQQCWIjvx5Awp7IzBP3qcHoTkguHy4S8Yovh4',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ product_id: productId })
            }
        );
        
        // Update local count for immediate feedback
        const product = allProducts.find(p => p.id === productId);
        if (product) {
            product.click_count = (product.click_count || 0) + 1;
        }
    } catch (err) {
        console.log('Click tracking failed (not critical):', err);
    }
}

// ─── Utility Functions ───────────────────────────────────────────────────────
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
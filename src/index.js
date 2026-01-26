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
const promotionSection = document.getElementById('promotionSection');
const promotionProducts = document.getElementById('promotionProducts');
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

// ─── Category Search Input ───────────────────────────────────────────────────
const categorySearchInput = document.getElementById('categorySearchInput');

// ─── All Categories with Counts (for filtering) ─────────────────────────────
let allCategoriesWithCounts = [];

// ─── Load Categories ─────────────────────────────────────────────────────────
async function loadCategories() {
    try {
        // Wait for products to load first so we can count them
        const categoryCounts = {};
        
        // Count products per category
        allProducts.forEach(product => {
            if (product.categories && Array.isArray(product.categories)) {
                product.categories.forEach(cat => {
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                });
            }
        });
        
        // Convert to array and sort by count (descending)
        allCategoriesWithCounts = Object.entries(categoryCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        
        if (allCategoriesWithCounts.length === 0) {
            categoryFilters.innerHTML = '<p class="no-data">No categories available</p>';
            return;
        }

        renderCategories(allCategoriesWithCounts);
        setupCategorySearchListener();

    } catch (err) {
        categoryFilters.innerHTML = `<p class="error">Failed to load categories: ${err.message}</p>`;
    }
}

// ─── Render Categories ───────────────────────────────────────────────────────
function renderCategories(categories) {
    categoryFilters.innerHTML = categories.map(({ name, count }) => `
        <label class="category-checkbox" data-category-name="${escapeHtml(name.toLowerCase())}">
            <input 
                type="checkbox" 
                value="${escapeHtml(name)}" 
                data-category="${escapeHtml(name)}"
                ${selectedCategories.has(name) ? 'checked' : ''}
            >
            <span>${escapeHtml(name)}</span>
            <span class="category-count">(${count})</span>
        </label>
    `).join('');

    // Add event listeners to checkboxes
    categoryFilters.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleCategoryChange);
    });
}

// ─── Category Search Handler ─────────────────────────────────────────────────
function setupCategorySearchListener() {
    categorySearchInput.addEventListener('input', () => {
        const searchTerm = categorySearchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            // Show all categories
            renderCategories(allCategoriesWithCounts);
            return;
        }
        
        // Filter categories by search term
        const filtered = allCategoriesWithCounts.filter(({ name }) => 
            name.toLowerCase().includes(searchTerm)
        );
        
        if (filtered.length === 0) {
            categoryFilters.innerHTML = '<p class="no-data">No matching categories</p>';
            return;
        }
        
        renderCategories(filtered);
    });
}

// ─── Load Products ───────────────────────────────────────────────────────────
async function loadProducts() {
    productsGrid.innerHTML = '<p class="loading">Loading products...</p>';
    recentProducts.innerHTML = '<p class="loading">Loading...</p>';
    popularProducts.innerHTML = '<p class="loading">Loading...</p>';
    
    try {
        allProducts = await db.selectAll();
        
        // Render all sections
        renderPromotionProducts();
        renderRecentProducts();
        renderPopularProducts();
        renderProducts(allProducts);
    } catch (err) {
        productsGrid.innerHTML = `<p class="error">Failed to load products: ${err.message}</p>`;
        recentProducts.innerHTML = `<p class="error">Failed to load</p>`;
        popularProducts.innerHTML = `<p class="error">Failed to load</p>`;
    }
}

// ─── Check if product has active promotion ───────────────────────────────────
function hasActivePromotion(product) {
    if (!product.discount_percent || product.discount_percent <= 0) return false;
    if (!product.promotion_end) return false;
    
    const now = new Date();
    const start = product.promotion_start ? new Date(product.promotion_start) : new Date(0);
    const end = new Date(product.promotion_end);
    
    return now >= start && now <= end;
}

// ─── Get discounted price ────────────────────────────────────────────────────
function getDiscountedPrice(product) {
    if (!product.price || !hasActivePromotion(product)) return null;
    return product.price * (1 - product.discount_percent / 100);
}

// ─── Render Promotion Products ───────────────────────────────────────────────
function renderPromotionProducts() {
    const promos = allProducts.filter(p => hasActivePromotion(p));
    
    // Hide entire section if no active promotions
    if (promos.length === 0) {
        promotionSection.style.display = 'none';
        return;
    }
    
    promotionSection.style.display = 'block';
    promotionProducts.innerHTML = promos.map(product => renderProductCard(product, true, true)).join('');
}

// ─── Render Recent Products (last 8 by created_at, only if within a week) ────
function renderRecentProducts() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Filter products added within the last week
    const recentWithinWeek = [...allProducts]
        .filter(p => p.created_at && new Date(p.created_at) >= oneWeekAgo)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8);
    
    const recentSection = document.getElementById('recentSection');
    
    // Hide entire section if no products within a week
    if (recentWithinWeek.length === 0) {
        recentSection.style.display = 'none';
        return;
    }
    
    recentSection.style.display = 'block';
    recentProducts.innerHTML = recentWithinWeek.map(product => renderProductCard(product, true)).join('');
}

// ─── Render Popular Products (admin marked as featured) ──────────────────────
function renderPopularProducts() {
    const popular = allProducts.filter(p => p.is_featured === true);
    
    // Hide section if no featured products
    const popularSection = document.getElementById('popularSection');
    if (popular.length === 0) {
        popularSection.style.display = 'none';
        return;
    }
    
    popularSection.style.display = 'block';
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
function renderProductCard(product, compact = false, showPromo = false) {
    // Handle multiple images
    const images = Array.isArray(product.image_urls) && product.image_urls.length > 0
        ? product.image_urls
        : (product.image_url ? [product.image_url] : []);
    
    const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/400x400?text=No+Image';
    
    // Check if first item is video (Cloudinary URLs contain /video/ for videos)
    const isVideo = mainImage.includes('/video/') || mainImage.includes('.mp4') || mainImage.includes('.webm');
    
    // Price with discount support
    const isOnSale = hasActivePromotion(product);
    const discountedPrice = getDiscountedPrice(product);
    
    let priceHtml = '';
    if (product.price) {
        if (isOnSale && discountedPrice !== null) {
            priceHtml = `
                <div class="price-container">
                    <span class="price-original">$${parseFloat(product.price).toFixed(2)}</span>
                    <span class="price-sale">$${discountedPrice.toFixed(2)}</span>
                </div>
            `;
        } else {
            priceHtml = `<p class="price">$${parseFloat(product.price).toFixed(2)}</p>`;
        }
    }
    
    const mediaCount = images.length > 1 ? `<span class="image-count-badge">${images.length}</span>` : '';
    const saleBadge = isOnSale ? `<span class="sale-badge">-${product.discount_percent}%</span>` : '';
    
    const mediaElement = isVideo 
        ? `<video src="${escapeHtml(mainImage)}" muted loop playsinline preload="metadata"></video>`
        : `<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.title)}" onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">`;
    
    return `
        <div class="product-card ${compact ? 'compact' : ''} ${isOnSale ? 'on-sale' : ''}" onclick="openProductModal('${product.id}')" data-id="${product.id}">
            <div class="product-image">
                ${mediaElement}
                ${mediaCount}
                ${saleBadge}
            </div>
            <div class="product-info">
                <h3 class="product-title">${escapeHtml(product.title)}</h3>
                ${priceHtml}
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
    
    // Handle multiple images
    const images = Array.isArray(product.image_urls) && product.image_urls.length > 0
        ? product.image_urls
        : (product.image_url ? [product.image_url] : []);
    
    const mainMedia = images.length > 0 ? images[0] : 'https://via.placeholder.com/400x400?text=No+Image';
    // Check for video (Cloudinary URLs contain /video/ for videos)
    const isVideo = mainMedia.includes('/video/') || mainMedia.includes('.mp4') || mainMedia.includes('.webm');
    
    const categories = product.categories && Array.isArray(product.categories) 
        ? product.categories.map(cat => `<span class="tag">${escapeHtml(cat)}</span>`).join('')
        : '';
    
    // Price with discount support
    const isOnSale = hasActivePromotion(product);
    const discountedPrice = getDiscountedPrice(product);
    
    let priceHtml = '';
    if (product.price) {
        if (isOnSale && discountedPrice !== null) {
            const endDate = new Date(product.promotion_end).toLocaleDateString();
            priceHtml = `
                <div class="modal-price-container">
                    <span class="modal-price-original">$${parseFloat(product.price).toFixed(2)}</span>
                    <span class="modal-price-sale">$${discountedPrice.toFixed(2)}</span>
                    <span class="modal-discount-badge">-${product.discount_percent}% OFF</span>
                </div>
                <p class="promo-ends">Sale ends: ${endDate}</p>
            `;
        } else {
            priceHtml = `<p class="modal-price">$${parseFloat(product.price).toFixed(2)}</p>`;
        }
    }
    
    const description = product.description 
        ? `<p class="modal-description">${escapeHtml(product.description)}</p>`
        : '';
    
    const adminNotes = product.admin_notes 
        ? `<div class="modal-notes"><strong>Note:</strong> ${escapeHtml(product.admin_notes)}</div>`
        : '';
    
    // Main media display
    const mainMediaHtml = isVideo 
        ? `<video id="modalMainMedia" src="${escapeHtml(mainMedia)}" controls muted loop playsinline preload="auto" class="modal-main-media"></video>`
        : `<img id="modalMainMedia" src="${escapeHtml(mainMedia)}" alt="${escapeHtml(product.title)}" class="modal-main-media">`;
    
    // Gallery thumbnails (only if multiple media)
    const galleryHtml = images.length > 1 
        ? `<div class="modal-gallery">
            ${images.map((img, idx) => {
                const isVid = img.includes('/video/') || img.includes('.mp4') || img.includes('.webm');
                return isVid 
                    ? `<div class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="changeModalMedia('${escapeHtml(img)}', this, true)">
                         <video src="${escapeHtml(img)}" muted playsinline preload="metadata"></video>
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
                ${priceHtml}
                ${description}
                <div class="modal-categories">${categories}</div>
                ${adminNotes}
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
        video.muted = true; // Safari requires muted for autoplay
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true; // Safari iOS requires this
        video.preload = 'auto';
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

// ─── Utility Functions ───────────────────────────────────────────────────────
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
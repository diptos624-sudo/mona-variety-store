// ============================================================
// MONA VARIETY STORE - FINAL APP.JS
// CART + CHECKOUT + WHATSAPP + OLD PRICE + IMAGES
// ============================================================

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

// ============================================================
// GLOBAL STATE
// ============================================================

let storeSettings = {};
let categories = [];
let products = [];
let paymentMethods = [];
let cart = [];

let currentCategory = "all";
let currentSearch = "";
let selectedProduct = null;

// ============================================================
// STORE CONTACT
// ============================================================

const STORE_WHATSAPP_NUMBER = "8801913726867";

// ============================================================
// START APP
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  loadCart();
  bindEvents();

  await loadStoreSettings();
  await loadCategories();
  await loadProducts();
  await loadPaymentMethods();

  renderAll();
  updateCartUI();
  updateContactLinks();

  console.log("Mona Variety Store initialized successfully.");
});

// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  const number = Number(value) || 0;

  return `৳${number.toLocaleString("en-BD")}`;
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString("en-BD");
}

function getProductImage(product) {
  if (!product) return "";

  return (
    product.image_url ||
    product.image ||
    product.product_image ||
    ""
  );
}

function getCategoryName(product) {
  if (!product) return "";

  if (product.category_id) {
    const category = categories.find(
      item =>
        String(item.id) ===
        String(product.category_id)
    );

    if (category) {
      return category.name || "";
    }
  }

  return product.category || "";
}

function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");

  if (!value) {
    return "";
  }

  if (value.startsWith("00")) {
    value = value.substring(2);
  }

  if (value.startsWith("880")) {
    return value;
  }

  if (value.startsWith("0")) {
    return "88" + value;
  }

  if (value.startsWith("1")) {
    return "880" + value;
  }

  return value;
}

function getWhatsAppNumber() {
  // Store's fixed official WhatsApp number
  // 01913726867 -> 8801913726867

  return STORE_WHATSAPP_NUMBER;
}

function getSettingValue(...keys) {
  for (const key of keys) {
    if (
      storeSettings &&
      storeSettings[key] !== null &&
      storeSettings[key] !== undefined &&
      storeSettings[key] !== ""
    ) {
      return storeSettings[key];
    }
  }

  return null;
}

// ============================================================
// STORE SETTINGS
// ============================================================

async function loadStoreSettings() {
  try {
    const { data, error } = await supabaseClient
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn(
        "Store settings error:",
        error
      );

      storeSettings = {};
      return;
    }

    storeSettings = data || {};

    console.log(
      "Store settings loaded:",
      storeSettings
    );

  } catch (error) {
    console.warn(
      "Store settings exception:",
      error
    );

    storeSettings = {};
  }
}

// ============================================================
// CATEGORIES
// ============================================================

async function loadCategories() {
  try {
    const { data, error } =
      await supabaseClient
        .from("categories")
        .select("*")
        .order("name", {
          ascending: true
        });

    if (error) {
      console.warn(
        "Categories error:",
        error
      );

      categories = [];
      return;
    }

    categories = data || [];

    console.log(
      "Categories loaded:",
      categories
    );

  } catch (error) {
    console.warn(
      "Categories exception:",
      error
    );

    categories = [];
  }
}

function renderCategories() {
  const container =
    document.querySelector("#categoryList") ||
    document.querySelector(".category-list") ||
    document.querySelector("#categories");

  if (!container) {
    return;
  }

  let html = `
    <button
      class="category-btn active"
      type="button"
      data-category="all"
      onclick="filterCategory('all')"
    >
      সব পণ্য
    </button>
  `;

  categories.forEach(category => {
    html += `
      <button
        class="category-btn"
        type="button"
        data-category="${escapeHTML(category.id)}"
        onclick="filterCategory('${escapeHTML(category.id)}')"
      >
        ${escapeHTML(
          category.name || "Category"
        )}
      </button>
    `;
  });

  container.innerHTML = html;

  updateCategoryButtons();
}

function filterCategory(categoryId) {
  currentCategory =
    String(categoryId || "all");

  updateCategoryButtons();
  renderProducts();
}

function updateCategoryButtons() {
  const buttons =
    document.querySelectorAll(
      ".category-btn, [data-category]"
    );

  buttons.forEach(button => {
    const value =
      String(
        button.dataset.category || ""
      );

    if (value === currentCategory) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
}

// ============================================================
// PRODUCTS
// ============================================================

async function loadProducts() {
  try {
    const { data, error } =
      await supabaseClient
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at", {
          ascending: false
        });

    if (error) {
      console.error(
        "Products error:",
        error
      );

      products = [];
      return;
    }

    products = data || [];

    console.log(
      "Products loaded:",
      products
    );

    console.log(
      "Products found:",
      products.length
    );

  } catch (error) {
    console.error(
      "Products exception:",
      error
    );

    products = [];
  }
}

function getFilteredProducts() {
  let result = [...products];

  // CATEGORY
  if (
    currentCategory &&
    currentCategory !== "all"
  ) {
    result = result.filter(
      product =>
        String(
          product.category_id || ""
        ) === String(currentCategory)
    );
  }

  // SEARCH
  if (currentSearch.trim()) {
    const search =
      currentSearch
        .trim()
        .toLowerCase();

    result = result.filter(product => {
      const name =
        String(
          product.name || ""
        ).toLowerCase();

      const description =
        String(
          product.description || ""
        ).toLowerCase();

      const categoryName =
        String(
          getCategoryName(product) || ""
        ).toLowerCase();

      return (
        name.includes(search) ||
        description.includes(search) ||
        categoryName.includes(search)
      );
    });
  }

  return result;
}

function renderProducts() {
  const filteredProducts =
    getFilteredProducts();

  const container =
    document.querySelector("#productGrid") ||
    document.querySelector(".product-grid") ||
    document.querySelector("#productsGrid") ||
    document.querySelector("#products");

  if (!container) {
    console.warn(
      "Product container not found."
    );

    return;
  }

  if (!filteredProducts.length) {
    container.innerHTML = `
      <div class="empty-products">
        <p>কোনো পণ্য পাওয়া যায়নি।</p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    filteredProducts
      .map(product =>
        productCard(product)
      )
      .join("");
}

function productCard(product) {
  const image =
    getProductImage(product);

  const name =
    escapeHTML(
      product.name || "Product"
    );

  const price =
    money(product.price);

  // OLD PRICE FIX
  const oldPriceValue =
    Number(product.old_price);

  const currentPrice =
    Number(product.price);

  const hasOldPrice =
    Number.isFinite(oldPriceValue) &&
    oldPriceValue > currentPrice;

  const oldPrice =
    hasOldPrice
      ? `
        <span class="old-price">
          ${money(oldPriceValue)}
        </span>
      `
      : "";

  const category =
    escapeHTML(
      getCategoryName(product)
    );

  const imageHTML = image
    ? `
      <img
        src="${escapeHTML(image)}"
        alt="${name}"
        loading="lazy"
        class="product-card-image"
        onerror="
          this.onerror=null;
          this.style.display='none';
          if(this.parentElement){
            this.parentElement.classList.add('image-error');
          }
        "
      >
    `
    : `
      <div class="product-image-placeholder">
        <span>📦</span>
      </div>
    `;

  return `
    <div
      class="product-card"
      data-product-id="${escapeHTML(product.id)}"
    >

      <div
        class="product-image"
        onclick="openProductModal('${escapeHTML(product.id)}')"
      >
        ${imageHTML}
      </div>

      <div class="product-info">

        ${
          category
            ? `
              <div class="product-category">
                ${category}
              </div>
            `
            : ""
        }

        <h3 class="product-name">
          ${name}
        </h3>

        <div class="product-price">
          <span class="current-price">
            ${price}
          </span>

          ${oldPrice}
        </div>

        <button
          type="button"
          class="add-to-cart-btn"
          onclick="addToCart('${escapeHTML(product.id)}')"
        >
          🛒 কার্টে যোগ করুন
        </button>

      </div>

    </div>
  `;
}

// ============================================================
// PRODUCT MODAL
// ============================================================

function openProductModal(productId) {
  const product =
    getProductById(productId);

  if (!product) {
    alert("পণ্য পাওয়া যায়নি।");
    return;
  }

  selectedProduct = product;

  const modal =
    document.querySelector(
      "#productModal"
    ) ||
    document.querySelector(
      ".product-modal"
    );

  if (!modal) {
    addToCart(product.id);
    return;
  }

  const image =
    getProductImage(product);

  const imageElement =
    modal.querySelector(
      "#modalProductImage"
    ) ||
    modal.querySelector(
      ".modal-product-image"
    );

  const titleElement =
    modal.querySelector(
      "#modalProductName"
    ) ||
    modal.querySelector(
      ".modal-product-name"
    );

  const priceElement =
    modal.querySelector(
      "#modalProductPrice"
    ) ||
    modal.querySelector(
      ".modal-product-price"
    );

  const descriptionElement =
    modal.querySelector(
      "#modalProductDescription"
    ) ||
    modal.querySelector(
      ".modal-product-description"
    );

  const oldPriceElement =
    modal.querySelector(
      "#modalProductOldPrice"
    ) ||
    modal.querySelector(
      ".modal-product-old-price"
    );

  if (imageElement) {
    if (image) {
      imageElement.src = image;
      imageElement.style.display =
        "block";
    } else {
      imageElement.removeAttribute(
        "src"
      );

      imageElement.style.display =
        "none";
    }
  }

  if (titleElement) {
    titleElement.textContent =
      product.name || "";
  }

  if (priceElement) {
    priceElement.textContent =
      money(product.price);
  }

  if (oldPriceElement) {
    const oldPrice =
      Number(product.old_price);

    const price =
      Number(product.price);

    if (
      Number.isFinite(oldPrice) &&
      oldPrice > price
    ) {
      oldPriceElement.textContent =
        money(oldPrice);

      oldPriceElement.style.display =
        "";

      oldPriceElement.style.textDecoration =
        "line-through";
    } else {
      oldPriceElement.style.display =
        "none";
    }
  }

  if (descriptionElement) {
    descriptionElement.textContent =
      product.description || "";
  }

  modal.classList.add("show");
  modal.classList.add("active");
}

function closeProductModal() {
  const modal =
    document.querySelector(
      "#productModal"
    ) ||
    document.querySelector(
      ".product-modal"
    );

  if (!modal) {
    return;
  }

  modal.classList.remove("show");
  modal.classList.remove("active");

  selectedProduct = null;
}

// ============================================================
// CART STORAGE
// ============================================================

function loadCart() {
  try {
    const saved =
      localStorage.getItem(
        "monaCart"
      );

    if (!saved) {
      cart = [];
      return;
    }

    const parsed =
      JSON.parse(saved);

    cart =
      Array.isArray(parsed)
        ? parsed
        : [];

  } catch (error) {
    console.warn(
      "Cart load error:",
      error
    );

    cart = [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(
      "monaCart",
      JSON.stringify(cart)
    );
  } catch (error) {
    console.warn(
      "Cart save error:",
      error
    );
  }
}

// ============================================================
// ADD TO CART
// ============================================================

function addToCart(productId) {
  const product =
    getProductById(productId);

  if (!product) {
    alert("পণ্য পাওয়া যায়নি।");
    return;
  }

  const stock =
    Number(product.stock);

  if (
    Number.isFinite(stock) &&
    stock <= 0
  ) {
    alert(
      "এই পণ্যটি বর্তমানে স্টকে নেই।"
    );

    return;
  }

  const existing =
    cart.find(
      item =>
        String(item.id) ===
        String(product.id)
    );

  if (existing) {
    const newQuantity =
      Number(
        existing.quantity || 0
      ) + 1;

    if (
      Number.isFinite(stock) &&
      stock > 0 &&
      newQuantity > stock
    ) {
      alert(
        `সর্বোচ্চ ${stock} টি নেওয়া যাবে।`
      );

      return;
    }

    existing.quantity =
      newQuantity;

    // Refresh product information
    existing.name =
      product.name;

    existing.price =
      Number(product.price) || 0;

    existing.image =
      getProductImage(product);

  } else {
    cart.push({
      id: product.id,
      name:
        product.name || "Product",
      price:
        Number(product.price) || 0,
      image:
        getProductImage(product),
      quantity: 1
    });
  }

  saveCart();

  updateCartUI();
  renderCart();
  updateCartTotals();

  closeProductModal();

  // Open drawer if available
  const drawer =
    document.getElementById(
      "cartDrawer"
    );

  if (drawer) {
    setTimeout(() => {
      openCart();
    }, 50);
  }
}

// ============================================================
// CHANGE QUANTITY
// ============================================================

function changeQuantity(
  productId,
  change
) {
  const item =
    getCartItemById(productId);

  if (!item) {
    return;
  }

  let quantity =
    Number(item.quantity || 1) +
    Number(change || 0);

  if (quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  const product =
    getProductById(productId);

  if (
    product &&
    Number(product.stock) > 0 &&
    quantity >
      Number(product.stock)
  ) {
    quantity =
      Number(product.stock);

    alert(
      `সর্বোচ্চ ${product.stock} টি নেওয়া যাবে।`
    );
  }

  item.quantity =
    quantity;

  saveCart();

  updateCartUI();
  renderCart();
  updateCartTotals();
  updateCheckoutTotals();
}

// ============================================================
// REMOVE CART ITEM
// ============================================================

function removeFromCart(productId) {
  cart =
    cart.filter(
      item =>
        String(item.id) !==
        String(productId)
    );

  saveCart();

  updateCartUI();
  renderCart();
  updateCartTotals();
  updateCheckoutTotals();
}

// ============================================================
// CART TOTALS
// ============================================================

function getCartSubtotal() {
  return cart.reduce(
    (total, item) => {
      return (
        total +
        (Number(item.price) || 0) *
        (Number(item.quantity) || 0)
      );
    },
    0
  );
}

function calculateDelivery() {
  const subtotal =
    getCartSubtotal();

  const freeMinimum =
    Number(
      getSettingValue(
        "free_delivery_minimum",
        "free_delivery_amount",
        "free_shipping_minimum"
      )
    );

  const delivery =
    Number(
      getSettingValue(
        "delivery_charge",
        "delivery_fee",
        "shipping_charge",
        "delivery"
      )
    );

  if (
    freeMinimum > 0 &&
    subtotal >= freeMinimum
  ) {
    return 0;
  }

  return delivery || 0;
}

// ============================================================
// CART UI
// ============================================================

function updateCartUI() {
  const count =
    cart.reduce(
      (total, item) =>
        total +
        (Number(item.quantity) || 0),
      0
    );

  const elements =
    document.querySelectorAll(
      "#cartCount, .cart-count, [data-cart-count]"
    );

  elements.forEach(
    element => {
      element.textContent =
        count;
    }
  );
}

function renderCart() {
  const container =
    document.querySelector(
      "#cartItems"
    ) ||
    document.querySelector(
      ".cart-items"
    ) ||
    document.querySelector(
      "#cartItemList"
    );

  if (!container) {
    return;
  }

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <p>আপনার কার্ট খালি।</p>
      </div>
    `;

    updateCartTotals();
    return;
  }

  container.innerHTML =
    cart
      .map(item =>
        cartItemHTML(item)
      )
      .join("");

  updateCartTotals();
}

function cartItemHTML(item) {
  const image =
    item.image || "";

  return `
    <div
      class="cart-item"
      data-cart-id="${escapeHTML(item.id)}"
    >

      <div class="cart-item-image">

        ${
          image
            ? `
              <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(item.name)}"
                loading="lazy"
                onerror="this.style.display='none';"
              >
            `
            : `
              <div class="cart-image-placeholder">
                📦
              </div>
            `
        }

      </div>

      <div class="cart-item-info">

        <div class="cart-item-name">
          ${escapeHTML(item.name)}
        </div>

        <div class="cart-item-price">
          ${money(item.price)}
        </div>

        <div class="cart-quantity">

          <button
            type="button"
            onclick="changeQuantity('${escapeHTML(item.id)}', -1)"
          >
            −
          </button>

          <span>
            ${Number(item.quantity) || 0}
          </span>

          <button
            type="button"
            onclick="changeQuantity('${escapeHTML(item.id)}', 1)"
          >
            +
          </button>

        </div>

        <button
          type="button"
          class="remove-cart-item"
          onclick="removeFromCart('${escapeHTML(item.id)}')"
        >
          Remove
        </button>

      </div>

    </div>
  `;
}

function updateCartTotals() {
  const subtotal =
    getCartSubtotal();

  const delivery =
    calculateDelivery();

  const total =
    subtotal + delivery;

  document
    .querySelectorAll(
      "#cartSubtotal, .cart-subtotal"
    )
    .forEach(element => {
      element.textContent =
        money(subtotal);
    });

  document
    .querySelectorAll(
      "#cartDelivery, .cart-delivery, #deliveryCharge"
    )
    .forEach(element => {
      element.textContent =
        money(delivery);
    });

  document
    .querySelectorAll(
      "#cartTotal, .cart-total"
    )
    .forEach(element => {
      element.textContent =
        money(total);
    });
}

// ============================================================
// OPEN CART
// SUPPORT BOTH DRAWER AND MODAL
// ============================================================

function openCart() {
  const drawer =
    document.getElementById(
      "cartDrawer"
    );

  const overlay =
    document.getElementById(
      "cartOverlay"
    );

  // Preferred drawer
  if (drawer) {
    renderCart();

    drawer.classList.add(
      "open"
    );

    drawer.classList.add(
      "show"
    );

    drawer.classList.add(
      "active"
    );

    if (overlay) {
      overlay.classList.add(
        "show"
      );

      overlay.classList.add(
        "active"
      );
    }

    document.body.style.overflow =
      "hidden";

    return;
  }

  // Fallback modal
  const cartModal =
    document.querySelector(
      "#cartModal"
    ) ||
    document.querySelector(
      ".cart-modal"
    );

  if (!cartModal) {
    console.warn(
      "Cart drawer/modal not found."
    );

    return;
  }

  renderCart();

  cartModal.classList.add(
    "show"
  );

  cartModal.classList.add(
    "active"
  );

  document.body.style.overflow =
    "hidden";
}

function closeCart() {
  const drawer =
    document.getElementById(
      "cartDrawer"
    );

  const overlay =
    document.getElementById(
      "cartOverlay"
    );

  if (drawer) {
    drawer.classList.remove(
      "open"
    );

    drawer.classList.remove(
      "show"
    );

    drawer.classList.remove(
      "active"
    );
  }

  if (overlay) {
    overlay.classList.remove(
      "show"
    );

    overlay.classList.remove(
      "active"
    );
  }

  const cartModal =
    document.querySelector(
      "#cartModal"
    ) ||
    document.querySelector(
      ".cart-modal"
    );

  if (cartModal) {
    cartModal.classList.remove(
      "show"
    );

    cartModal.classList.remove(
      "active"
    );
  }

  document.body.style.overflow =
    "";
}

// ============================================================
// PAYMENT METHODS
// ============================================================

async function loadPaymentMethods() {
  try {
    const { data, error } =
      await supabaseClient
        .from("payment_methods")
        .select("*");

    if (error) {
      console.warn(
        "Payment methods error:",
        error
      );

      paymentMethods = [];
      return;
    }

    paymentMethods = data || [];

    console.log(
      "Payment methods loaded:",
      paymentMethods
    );

  } catch (error) {
    console.warn(
      "Payment methods exception:",
      error
    );

    paymentMethods = [];
  }
}

function renderPaymentMethods() {
  const container =
    document.querySelector(
      "#checkoutPaymentMethods"
    ) ||
    document.querySelector(
      ".checkout-payment-methods"
    );

  if (!container) {
    return;
  }

  if (!paymentMethods.length) {
    container.innerHTML = `
      <p class="payment-empty">
        Payment method পাওয়া যাচ্ছে না।
      </p>
    `;

    return;
  }

  container.innerHTML =
    paymentMethods
      .map(
        (method, index) => {
          const id =
            method.id ??
            index;

          const name =
            method.name ||
            method.title ||
            method.method ||
            "Payment";

          return `
            <label class="payment-method-option">

              <input
                type="radio"
                name="paymentMethod"
                value="${escapeHTML(id)}"
                ${index === 0 ? "checked" : ""}
              >

              <span>
                ${escapeHTML(name)}
              </span>

            </label>
          `;
        }
      )
      .join("");
}

function getSelectedPaymentMethod() {
  const selected =
    document.querySelector(
      'input[name="paymentMethod"]:checked'
    );

  if (!selected) {
    return "";
  }

  const id =
    selected.value;

  const method =
    paymentMethods.find(
      item =>
        String(item.id) ===
        String(id)
    );

  if (!method) {
    return id;
  }

  return (
    method.name ||
    method.title ||
    method.method ||
    id
  );
}

// ============================================================
// CHECKOUT
// ============================================================

function openCheckout() {
  if (!cart.length) {
    alert(
      "আপনার কার্ট খালি।"
    );

    return;
  }

  const modal =
    document.querySelector(
      "#checkoutModal"
    ) ||
    document.querySelector(
      ".checkout-modal"
    );

  if (!modal) {
    console.warn(
      "Checkout modal not found."
    );

    return;
  }

  renderPaymentMethods();
  updateCheckoutTotals();

  modal.classList.add(
    "show"
  );

  modal.classList.add(
    "active"
  );

  document.body.style.overflow =
    "hidden";
}

function closeCheckout() {
  const modal =
    document.querySelector(
      "#checkoutModal"
    ) ||
    document.querySelector(
      ".checkout-modal"
    );

  if (!modal) {
    return;
  }

  modal.classList.remove(
    "show"
  );

  modal.classList.remove(
    "active"
  );

  document.body.style.overflow =
    "";
}

function updateCheckoutTotals() {
  const subtotal =
    getCartSubtotal();

  const delivery =
    calculateDelivery();

  const total =
    subtotal + delivery;

  document
    .querySelectorAll(
      "#checkoutSubtotal, .checkout-subtotal"
    )
    .forEach(element => {
      element.textContent =
        money(subtotal);
    });

  document
    .querySelectorAll(
      "#checkoutDelivery, .checkout-delivery, #checkoutDeliveryCharge"
    )
    .forEach(element => {
      element.textContent =
        money(delivery);
    });

  document
    .querySelectorAll(
      "#checkoutTotal, .checkout-total"
    )
    .forEach(element => {
      element.textContent =
        money(total);
    });
}

function getCheckoutData() {
  const nameInput =
    document.querySelector(
      "#customerName"
    );

  const phoneInput =
    document.querySelector(
      "#customerPhone"
    );

  const addressInput =
    document.querySelector(
      "#customerAddress"
    );

  const noteInput =
    document.querySelector(
      "#customerNote"
    );

  return {
    name:
      nameInput
        ? nameInput.value.trim()
        : "",

    phone:
      phoneInput
        ? phoneInput.value.trim()
        : "",

    address:
      addressInput
        ? addressInput.value.trim()
        : "",

    note:
      noteInput
        ? noteInput.value.trim()
        : "",

    payment:
      getSelectedPaymentMethod()
  };
}

function validateCheckout() {
  const data =
    getCheckoutData();

  if (!data.name) {
    return {
      valid: false,
      message:
        "আপনার নাম দিন।"
    };
  }

  if (!data.phone) {
    return {
      valid: false,
      message:
        "আপনার ফোন নম্বর দিন।"
    };
  }

  if (!data.address) {
    return {
      valid: false,
      message:
        "আপনার ঠিকানা দিন।"
    };
  }

  if (!data.payment) {
    return {
      valid: false,
      message:
        "একটি payment method নির্বাচন করুন।"
    };
  }

  return {
    valid: true,
    data
  };
}

// ============================================================
// PLACE ORDER
// ============================================================

async function placeOrder() {
  if (!cart.length) {
    alert(
      "আপনার কার্ট খালি।"
    );

    return;
  }

  const validation =
    validateCheckout();

  if (!validation.valid) {
    alert(
      validation.message
    );

    return;
  }

  const data =
    validation.data;

  const subtotal =
    getCartSubtotal();

  const delivery =
    calculateDelivery();

  const total =
    subtotal + delivery;

  // IMPORTANT:
  // Copy cart BEFORE clearing it.
  const orderItems =
    cart.map(item => ({
      id: item.id,
      name:
        item.name || "",
      price:
        Number(item.price) || 0,
      quantity:
        Number(item.quantity) || 1,
      image:
        item.image || ""
    }));

  const orderId =
    crypto.randomUUID();

  const orderPayload = {
    id: orderId,

    customer_name:
      String(
        data.name || ""
      ).trim(),

    phone:
      String(
        data.phone || ""
      ).trim(),

    address:
      String(
        data.address || ""
      ).trim(),

    items:
      orderItems,

    subtotal:
      Number(subtotal) || 0,

    delivery_charge:
      Number(delivery) || 0,

    total:
      Number(total) || 0,

    payment_method:
      data.payment
        ? String(
            data.payment
          ).trim()
        : null,

    note:
      data.note
        ? String(
            data.note
          ).trim()
        : null,

    status:
      "pending"
  };

  const button =
    document.querySelector(
      "#placeOrderBtn"
    );

  const originalButtonText =
    button
      ? button.textContent
      : "অর্ডার করুন";

  try {
    if (button) {
      button.disabled =
        true;

      button.textContent =
        "অর্ডার করা হচ্ছে...";
    }

    console.log(
      "Creating order:",
      orderPayload
    );

    const { error } =
      await supabaseClient
        .from("orders")
        .insert(
          orderPayload
        );

    if (error) {
      console.error(
        "Order insert error:",
        error
      );

      alert(
        "অর্ডার করা যায়নি।\n\n" +
        error.message
      );

      return;
    }

    const order = {
      ...orderPayload
    };

    console.log(
      "Order created:",
      order
    );

    // Create WhatsApp message BEFORE clearing cart.
    const whatsappMessage =
      createWhatsAppMessage(
        order,
        data,
        orderItems
      );

    // Clear cart
    cart = [];

    saveCart();
    renderCart();
    updateCartUI();
    updateCartTotals();
    updateCheckoutTotals();

    // Close checkout
    closeCheckout();

    // Show success
    showOrderSuccess(
      order,
      whatsappMessage
    );

  } catch (error) {
    console.error(
      "Place order exception:",
      error
    );

    alert(
      "অর্ডার করার সময় সমস্যা হয়েছে।\n\n" +
      (
        error.message ||
        error
      )
    );

  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        originalButtonText ||
        "অর্ডার করুন";
    }
  }
}

// ============================================================
// WHATSAPP MESSAGE
// ============================================================

function createWhatsAppMessage(
  order,
  customerData,
  orderItems
) {
  const lines = [];

  lines.push(
    "🛍️ *নতুন অর্ডার - Mona Variety Store*"
  );

  lines.push("");

  lines.push(
    `📦 Order ID: ${order?.id || "N/A"}`
  );

  lines.push(
    `👤 নাম: ${customerData.name || ""}`
  );

  lines.push(
    `📞 ফোন: ${customerData.phone || ""}`
  );

  lines.push(
    `📍 ঠিকানা: ${customerData.address || ""}`
  );

  lines.push("");

  lines.push(
    "🛒 *পণ্য:*"
  );

  const items =
    Array.isArray(orderItems)
      ? orderItems
      : Array.isArray(order?.items)
        ? order.items
        : [];

  items.forEach(
    (item, index) => {
      const quantity =
        Number(
          item.quantity
        ) || 1;

      const price =
        Number(
          item.price
        ) || 0;

      const itemTotal =
        price * quantity;

      lines.push(
        `${index + 1}. ${item.name} × ${quantity} = ${money(itemTotal)}`
      );
    }
  );

  lines.push("");

  lines.push(
    `💰 Subtotal: ${money(order.subtotal)}`
  );

  lines.push(
    `🚚 Delivery: ${money(order.delivery_charge)}`
  );

  lines.push(
    `💵 *Total: ${money(order.total)}*`
  );

  lines.push(
    `💳 Payment: ${
      customerData.payment ||
      order.payment_method ||
      "N/A"
    }`
  );

  if (customerData.note) {
    lines.push(
      `📝 Note: ${customerData.note}`
    );
  }

  return lines.join(
    "\n"
  );
}

// ============================================================
// SUCCESS MODAL
// ============================================================

function showOrderSuccess(
  order,
  whatsappMessage
) {
  const modal =
    document.querySelector(
      "#successModal"
    ) ||
    document.querySelector(
      ".success-modal"
    );

  const orderIdElement =
    document.querySelector(
      "#successOrderId"
    );

  if (orderIdElement) {
    orderIdElement.textContent =
      order?.id || "";
  }

  const whatsappButton =
    document.querySelector(
      "#successWhatsappBtn"
    ) ||
    document.querySelector(
      "#successWhatsAppBtn"
    );

  if (whatsappButton) {
    const number =
      getWhatsAppNumber();

    if (number) {
      whatsappButton.style.display =
        "";

      whatsappButton.onclick =
        function () {
          openWhatsAppMessage(
            whatsappMessage
          );
        };
    } else {
      whatsappButton.style.display =
        "none";
    }
  }

  if (!modal) {
    alert(
      "অর্ডার সফল হয়েছে!\n\nOrder ID: " +
      (order?.id || "")
    );

    return;
  }

  modal.classList.add(
    "show"
  );

  modal.classList.add(
    "active"
  );

  document.body.style.overflow =
    "hidden";
}

function closeSuccessModal() {
  const modal =
    document.querySelector(
      "#successModal"
    ) ||
    document.querySelector(
      ".success-modal"
    );

  if (!modal) {
    return;
  }

  modal.classList.remove(
    "show"
  );

  modal.classList.remove(
    "active"
  );

  document.body.style.overflow =
    "";
}

// ============================================================
// OPEN WHATSAPP
// ============================================================

function openWhatsAppMessage(
  message
) {
  const number =
    getWhatsAppNumber();

  if (!number) {
    alert(
      "WhatsApp নম্বর পাওয়া যায়নি।"
    );

    return;
  }

  const url =
    "https://wa.me/" +
    number +
    "?text=" +
    encodeURIComponent(
      message || ""
    );

  window.open(
    url,
    "_blank"
  );
}

// ============================================================
// SEARCH
// ============================================================

function handleSearch(event) {
  const input =
    event?.target ||
    document.querySelector(
      "#searchInput"
    ) ||
    document.querySelector(
      ".search-input"
    );

  if (!input) {
    return;
  }

  currentSearch =
    input.value || "";

  renderProducts();
}

function clearSearch() {
  currentSearch = "";

  document
    .querySelectorAll(
      "#searchInput, .search-input"
    )
    .forEach(input => {
      input.value = "";
    });

  renderProducts();
}

// ============================================================
// STORE CONTACT
// ============================================================

function getStorePhone() {
  const setting =
    getSettingValue(
      "phone",
      "phone_number",
      "mobile",
      "contact_phone"
    );

  return normalizePhone(
    setting || STORE_WHATSAPP_NUMBER
  );
}

function getStoreFacebook() {
  return (
    getSettingValue(
      "facebook",
      "facebook_url",
      "facebook_link"
    ) || ""
  );
}

function getStoreTikTok() {
  return (
    getSettingValue(
      "tiktok",
      "tiktok_url",
      "tiktok_link"
    ) || ""
  );
}

// ============================================================
// UPDATE CONTACT LINKS
// ============================================================

function updateContactLinks() {
  const whatsapp =
    getWhatsAppNumber();

  const phone =
    getStorePhone();

  const facebook =
    getStoreFacebook();

  const tiktok =
    getStoreTikTok();

  // WHATSAPP
  if (whatsapp) {
    document
      .querySelectorAll(
        'a[href*="wa.me"], a[href*="whatsapp"], [data-whatsapp]'
      )
      .forEach(link => {
        const oldHref =
          link.getAttribute(
            "href"
          ) || "";

        let newHref =
          "https://wa.me/" +
          whatsapp;

        const questionIndex =
          oldHref.indexOf(
            "?text="
          );

        if (
          questionIndex !== -1
        ) {
          newHref +=
            oldHref.substring(
              questionIndex
            );
        }

        link.setAttribute(
          "href",
          newHref
        );
      });
  }

  // PHONE
  if (phone) {
    document
      .querySelectorAll(
        'a[href^="tel:"], [data-phone]'
      )
      .forEach(link => {
        link.setAttribute(
          "href",
          "tel:" + phone
        );
      });
  }

  // FACEBOOK
  if (facebook) {
    document
      .querySelectorAll(
        "[data-facebook]"
      )
      .forEach(link => {
        link.setAttribute(
          "href",
          facebook
        );
      });
  }

  // TIKTOK
  if (tiktok) {
    document
      .querySelectorAll(
        "[data-tiktok]"
      )
      .forEach(link => {
        link.setAttribute(
          "href",
          tiktok
        );
      });
  }
}

// ============================================================
// EVENTS
// ============================================================

function bindEvents() {

  // SEARCH
  const searchInput =
    document.querySelector(
      "#searchInput"
    ) ||
    document.querySelector(
      ".search-input"
    );

  if (searchInput) {
    searchInput.addEventListener(
      "input",
      handleSearch
    );
  }

  // CART BUTTONS
  document
    .querySelectorAll(
      "#cartBtn, .cart-btn, [data-open-cart]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          openCart();
        }
      );
    });

  // CHECKOUT BUTTONS
  document
    .querySelectorAll(
      "#checkoutBtn, .checkout-btn, [data-open-checkout]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          openCheckout();
        }
      );
    });

  // PLACE ORDER
  const placeOrderButton =
    document.querySelector(
      "#placeOrderBtn"
    );

  if (placeOrderButton) {
    placeOrderButton.addEventListener(
      "click",
      event => {
        event.preventDefault();
        placeOrder();
      }
    );
  }

  // CLOSE CART
  document
    .querySelectorAll(
      "#closeCartBtn, .close-cart, [data-close-cart]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          closeCart();
        }
      );
    });

  // CLOSE CHECKOUT
  document
    .querySelectorAll(
      "#closeCheckoutBtn, .close-checkout, [data-close-checkout]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          closeCheckout();
        }
      );
    });

  // CLOSE PRODUCT
  document
    .querySelectorAll(
      "#closeProductModal, .close-product-modal"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          closeProductModal();
        }
      );
    });

  // CLOSE SUCCESS
  document
    .querySelectorAll(
      "#closeSuccessModal, .close-success-modal"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          closeSuccessModal();
        }
      );
    });

  // PAYMENT CHANGE
  document.addEventListener(
    "change",
    event => {
      if (
        event.target &&
        event.target.name ===
          "paymentMethod"
      ) {
        updateCheckoutTotals();
      }
    }
  );

  // CART OVERLAY
  const cartOverlay =
    document.getElementById(
      "cartOverlay"
    );

  if (cartOverlay) {
    cartOverlay.addEventListener(
      "click",
      closeCart
    );
  }
}

// ============================================================
// RENDER ALL
// ============================================================

function renderAll() {
  renderCategories();
  renderProducts();
  renderPaymentMethods();
  renderCart();

  updateCartUI();
  updateCartTotals();
  updateCheckoutTotals();

  // STORE NAME
  const storeName =
    getSettingValue(
      "store_name",
      "name",
      "business_name"
    );

  if (storeName) {
    document
      .querySelectorAll(
        "#storeName, .store-name"
      )
      .forEach(element => {
        element.textContent =
          storeName;
      });
  }

  // STORE LOGO
  const logo =
    getSettingValue(
      "logo_url",
      "logo",
      "store_logo"
    );

  if (logo) {
    document
      .querySelectorAll(
        "#storeLogo, .store-logo"
      )
      .forEach(element => {
        if (
          element.tagName ===
          "IMG"
        ) {
          element.src =
            logo;

          element.onerror =
            function () {
              this.style.display =
                "none";
            };
        }
      });
  }
}

// ============================================================
// REFRESH HELPERS
// ============================================================

function refreshProductDisplay() {
  renderProducts();
  updateCartUI();
  renderCart();
  updateCartTotals();
  updateCheckoutTotals();
}

function refreshStoreUI() {
  renderCategories();
  renderProducts();
  renderPaymentMethods();
  renderCart();

  updateCartUI();
  updateCartTotals();
  updateCheckoutTotals();
  updateContactLinks();
}

function renderProductGrid() {
  renderProducts();
}

function displayProducts() {
  renderProducts();
}

// ============================================================
// GETTERS
// ============================================================

function getProductById(id) {
  return products.find(
    product =>
      String(product.id) ===
      String(id)
  );
}

function getCartItemById(id) {
  return cart.find(
    item =>
      String(item.id) ===
      String(id)
  );
}

// ============================================================
// CLOSE ALL MODALS
// ============================================================

function closeModal() {
  closeProductModal();
  closeCart();
  closeCheckout();
  closeSuccessModal();
}

// ============================================================
// OUTSIDE CLICK
// ============================================================

document.addEventListener(
  "click",
  event => {

    const target =
      event.target;

    // PRODUCT
    const productModal =
      document.querySelector(
        "#productModal"
      ) ||
      document.querySelector(
        ".product-modal"
      );

    if (
      productModal &&
      target === productModal
    ) {
      closeProductModal();
    }

    // CART
    const cartModal =
      document.querySelector(
        "#cartModal"
      ) ||
      document.querySelector(
        ".cart-modal"
      );

    if (
      cartModal &&
      target === cartModal
    ) {
      closeCart();
    }

    // CHECKOUT
    const checkoutModal =
      document.querySelector(
        "#checkoutModal"
      ) ||
      document.querySelector(
        ".checkout-modal"
      );

    if (
      checkoutModal &&
      target === checkoutModal
    ) {
      closeCheckout();
    }

    // SUCCESS
    const successModal =
      document.querySelector(
        "#successModal"
      ) ||
      document.querySelector(
        ".success-modal"
      );

    if (
      successModal &&
      target === successModal
    ) {
      closeSuccessModal();
    }
  }
);

// ============================================================
// ESC KEY
// ============================================================

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key !==
      "Escape"
    ) {
      return;
    }

    closeProductModal();
    closeCart();
    closeCheckout();
    closeSuccessModal();
  }
);

// ============================================================
// CART STORAGE SYNC
// ============================================================

window.addEventListener(
  "storage",
  event => {
    if (
      event.key !==
      "monaCart"
    ) {
      return;
    }

    loadCart();

    updateCartUI();
    renderCart();
    updateCartTotals();
    updateCheckoutTotals();
  }
);

// ============================================================
// PAGE VISIBILITY
// ============================================================

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      loadCart();

      updateCartUI();
      renderCart();
      updateCartTotals();
      updateCheckoutTotals();
    }
  }
);

// ============================================================
// GLOBAL IMAGE FALLBACK
// ============================================================

document.addEventListener(
  "error",
  event => {
    const element =
      event.target;

    if (
      element &&
      element.tagName ===
        "IMG"
    ) {
      const isProductImage =
        element.closest(
          ".product-image"
        );

      const isCartImage =
        element.closest(
          ".cart-item-image"
        );

      if (
        isProductImage ||
        isCartImage
      ) {
        element.style.display =
          "none";
      }
    }
  },
  true
);

// ============================================================
// GLOBAL EXPORTS
// ============================================================

window.loadCart =
  loadCart;

window.saveCart =
  saveCart;

window.addToCart =
  addToCart;

window.changeQuantity =
  changeQuantity;

window.removeFromCart =
  removeFromCart;

window.openCart =
  openCart;

window.closeCart =
  closeCart;

window.openCheckout =
  openCheckout;

window.closeCheckout =
  closeCheckout;

window.placeOrder =
  placeOrder;

window.openProductModal =
  openProductModal;

window.closeProductModal =
  closeProductModal;

window.filterCategory =
  filterCategory;

window.handleSearch =
  handleSearch;

window.clearSearch =
  clearSearch;

window.showOrderSuccess =
  showOrderSuccess;

window.closeSuccessModal =
  closeSuccessModal;

window.openWhatsAppMessage =
  openWhatsAppMessage;

window.getWhatsAppNumber =
  getWhatsAppNumber;

window.renderProducts =
  renderProducts;

window.renderProductGrid =
  renderProductGrid;

window.displayProducts =
  displayProducts;

window.closeModal =
  closeModal;

window.updateContactLinks =
  updateContactLinks;

window.refreshProductDisplay =
  refreshProductDisplay;

window.refreshStoreUI =
  refreshStoreUI;

window.getProductById =
  getProductById;

window.getCartItemById =
  getCartItemById;

// ============================================================
// DEBUG OBJECT
// ============================================================

window.MonaStore = {

  get products() {
    return products;
  },

  get categories() {
    return categories;
  },

  get cart() {
    return cart;
  },

  get paymentMethods() {
    return paymentMethods;
  },

  get storeSettings() {
    return storeSettings;
  },

  refresh() {
    refreshStoreUI();
  },

  reloadProducts() {
    return loadProducts().then(
      () => {
        renderProducts();
      }
    );
  },

  reloadCart() {
    loadCart();

    updateCartUI();
    renderCart();
    updateCartTotals();
    updateCheckoutTotals();
  }
};

// ============================================================
// FINAL CSS FIXES
// ============================================================

(function injectFinalStyles() {

  const style =
    document.createElement(
      "style"
    );

  style.textContent = `

    /* OLD PRICE */
    .old-price,
    .product-old-price,
    .modal-product-old-price {
      color: #999 !important;
      text-decoration: line-through !important;
      text-decoration-thickness: 1.5px !important;
      text-decoration-line: line-through !important;
      margin-left: 6px;
      font-size: 13px;
      font-weight: 400;
    }

    /* CURRENT PRICE */
    .current-price {
      text-decoration: none !important;
    }

    /* CART DRAWER */
    #cartDrawer {
      z-index: 1000 !important;
    }

    #cartOverlay {
      z-index: 999 !important;
    }

    /* PRODUCT IMAGES */
    .product-card-image {
      display: block;
      width: 100%;
      height: auto;
      object-fit: cover;
    }

    /* CART IMAGES */
    .cart-item-image img {
      max-width: 100%;
      display: block;
      object-fit: cover;
    }

    /* EMPTY IMAGE */
    .product-image-placeholder,
    .cart-image-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100px;
    }

  `;

  document.head.appendChild(
    style
  );

})();

// ============================================================
// FINAL LOG
// ============================================================

console.log(
  "Mona Variety Store FINAL app.js loaded successfully."
);

console.log(
  "WhatsApp:",
  STORE_WHATSAPP_NUMBER
);

// ============================================================
// END OF APP.JS
// ============================================================

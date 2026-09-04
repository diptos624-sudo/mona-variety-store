// ============================================================
// MONA VARIETY STORE - APP.JS
// PART 1 / 3
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
});

// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

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

function getProductImage(product) {
  if (!product) return "";

  return (
    product.image_url ||
    product.image ||
    ""
  );
}

function getCategoryName(product) {
  if (!product) return "";

  if (product.category_id) {
    const category = categories.find(
      item => String(item.id) === String(product.category_id)
    );

    if (category) {
      return category.name || "";
    }
  }

  return product.category || "";
}

function normalizePhone(phone) {
  return String(phone || "")
    .replace(/\D/g, "")
    .replace(/^00/, "");
}

function getWhatsAppNumber() {
  const possibleKeys = [
    "whatsapp",
    "whatsapp_number",
    "whatsapp_phone",
    "phone",
    "mobile"
  ];

  for (const key of possibleKeys) {
    if (storeSettings?.[key]) {
      return normalizePhone(storeSettings[key]);
    }
  }

  return "";
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
      console.warn("Store settings error:", error);
      storeSettings = {};
      return;
    }

    storeSettings = data || {};

    console.log("Store settings loaded:", storeSettings);
  } catch (error) {
    console.warn("Store settings exception:", error);
    storeSettings = {};
  }
}

// ============================================================
// CATEGORIES
// ============================================================

async function loadCategories() {
  try {
    const { data, error } = await supabaseClient
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("Categories error:", error);
      categories = [];
      return;
    }

    categories = data || [];

    console.log("Categories loaded:", categories);
  } catch (error) {
    console.warn("Categories exception:", error);
    categories = [];
  }
}

function renderCategories() {
  const container =
    document.querySelector("#categoryList") ||
    document.querySelector(".category-list") ||
    document.querySelector("#categories");

  if (!container) return;

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
        ${escapeHTML(category.name || "Category")}
      </button>
    `;
  });

  container.innerHTML = html;

  updateCategoryButtons();
}

function filterCategory(categoryId) {
  currentCategory = String(categoryId || "all");

  updateCategoryButtons();
  renderProducts();
}

function updateCategoryButtons() {
  const buttons = document.querySelectorAll(
    ".category-btn, [data-category]"
  );

  buttons.forEach(button => {
    const value = String(
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
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Products error:", error);
      products = [];
      return;
    }

    products = data || [];

    console.log("Products loaded:", products);
    console.log("Products found:", products.length);
  } catch (error) {
    console.error("Products exception:", error);
    products = [];
  }
}

function getFilteredProducts() {
  let result = [...products];

  // CATEGORY FILTER
  if (
    currentCategory &&
    currentCategory !== "all"
  ) {
    result = result.filter(product => {
      return (
        String(product.category_id || "") ===
        String(currentCategory)
      );
    });
  }

  // SEARCH FILTER
  if (currentSearch.trim()) {
    const search = currentSearch
      .trim()
      .toLowerCase();

    result = result.filter(product => {
      const name = String(
        product.name || ""
      ).toLowerCase();

      const description = String(
        product.description || ""
      ).toLowerCase();

      const categoryName = String(
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
      .map(product => productCard(product))
      .join("");
}

function productCard(product) {
  const image = getProductImage(product);

  const name = escapeHTML(
    product.name || "Product"
  );

  const price = money(product.price);

  const oldPrice =
    product.old_price &&
    Number(product.old_price) >
      Number(product.price)
      ? `
        <span class="old-price">
          ${money(product.old_price)}
        </span>
      `
      : "";

  const category = escapeHTML(
    getCategoryName(product)
  );

  const imageHTML = image
    ? `
      <img
        src="${escapeHTML(image)}"
        alt="${name}"
        loading="lazy"
        onerror="this.style.display='none';"
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
          ${price}
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
  const product = products.find(
    item =>
      String(item.id) ===
      String(productId)
  );

  if (!product) return;

  selectedProduct = product;

  const modal =
    document.querySelector("#productModal") ||
    document.querySelector(".product-modal");

  if (!modal) {
    addToCart(product.id);
    return;
  }

  const image = getProductImage(product);

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

  if (imageElement) {
    if (image) {
      imageElement.src = image;
      imageElement.style.display =
        "block";
    } else {
      imageElement.removeAttribute("src");
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

  if (descriptionElement) {
    descriptionElement.textContent =
      product.description || "";
  }

  modal.classList.add("show");
  modal.classList.add("active");
}

function closeProductModal() {
  const modal =
    document.querySelector("#productModal") ||
    document.querySelector(".product-modal");

  if (!modal) return;

  modal.classList.remove("show");
  modal.classList.remove("active");

  selectedProduct = null;
}

// ============================================================
// CART
// ============================================================

function loadCart() {
  try {
    const saved =
      localStorage.getItem("monaCart");

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

function addToCart(productId) {
  const product = products.find(
    item =>
      String(item.id) ===
      String(productId)
  );

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
    alert("এই পণ্যটি বর্তমানে স্টকে নেই।");
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
      Number(existing.quantity || 0) +
      1;

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
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image:
        getProductImage(product),
      quantity: 1
    });
  }

  saveCart();
  updateCartUI();
  renderCart();

  closeProductModal();
}

function changeQuantity(
  productId,
  change
) {
  const item =
    cart.find(
      product =>
        String(product.id) ===
        String(productId)
    );

  if (!item) return;

  item.quantity =
    Number(item.quantity || 1) +
    Number(change || 0);

  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }

  const product =
    products.find(
      product =>
        String(product.id) ===
        String(productId)
    );

  if (
    product &&
    Number(product.stock) > 0 &&
    item.quantity >
      Number(product.stock)
  ) {
    item.quantity =
      Number(product.stock);

    alert(
      `সর্বোচ্চ ${product.stock} টি নেওয়া যাবে।`
    );
  }

  saveCart();
  updateCartUI();
  renderCart();
}

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
}

function getCartSubtotal() {
  return cart.reduce(
    (total, item) =>
      total +
      (Number(item.price) || 0) *
        (Number(item.quantity) || 0),
    0
  );
}

function calculateDelivery() {
  const subtotal =
    getCartSubtotal();

  const freeMinimum = Number(
    getSettingValue(
      "free_delivery_minimum",
      "free_delivery_amount",
      "free_shipping_minimum"
    )
  );

  const delivery = Number(
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

  elements.forEach(element => {
    element.textContent = count;
  });
}

function renderCart() {
  const container =
    document.querySelector("#cartItems") ||
    document.querySelector(".cart-items") ||
    document.querySelector("#cartItemList");

  if (!container) return;

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
      .map(item => cartItemHTML(item))
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
              >
            `
            : "📦"
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

  const subtotalElements =
    document.querySelectorAll(
      "#cartSubtotal, .cart-subtotal"
    );

  subtotalElements.forEach(
    element => {
      element.textContent =
        money(subtotal);
    }
  );

  const deliveryElements =
    document.querySelectorAll(
      "#cartDelivery, .cart-delivery, #deliveryCharge"
    );

  deliveryElements.forEach(
    element => {
      element.textContent =
        money(delivery);
    }
  );

  const totalElements =
    document.querySelectorAll(
      "#cartTotal, .cart-total"
    );

  totalElements.forEach(
    element => {
      element.textContent =
        money(total);
    }
  );
}

function openCart() {
  const cartModal =
    document.querySelector("#cartModal") ||
    document.querySelector(".cart-modal");

  if (!cartModal) return;

  renderCart();

  cartModal.classList.add("show");
  cartModal.classList.add("active");
}

function closeCart() {
  const cartModal =
    document.querySelector("#cartModal") ||
    document.querySelector(".cart-modal");

  if (!cartModal) return;

  cartModal.classList.remove("show");
  cartModal.classList.remove("active");
}

// ============================================================
// PAYMENT METHODS
// ============================================================

async function loadPaymentMethods() {
  try {
    // IMPORTANT:
    // payment_methods table does NOT have created_at,
    // so we do NOT order by created_at.

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

  if (!container) return;

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
      .map((method, index) => {
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
      })
      .join("");
}

function getSelectedPaymentMethod() {
  const selected =
    document.querySelector(
      'input[name="paymentMethod"]:checked'
    );

  if (!selected) return "";

  const id =
    selected.value;

  const method =
    paymentMethods.find(
      item =>
        String(
          item.id
        ) === String(id)
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
}// ============================================================
// CHECKOUT
// PART 2 / 3
// ============================================================

function openCheckout() {
  if (!cart.length) {
    alert("আপনার কার্ট খালি।");
    return;
  }

  const modal =
    document.querySelector("#checkoutModal") ||
    document.querySelector(".checkout-modal");

  if (!modal) {
    console.warn("Checkout modal not found.");
    return;
  }

  renderPaymentMethods();
  updateCheckoutTotals();

  modal.classList.add("show");
  modal.classList.add("active");
}

function closeCheckout() {
  const modal =
    document.querySelector("#checkoutModal") ||
    document.querySelector(".checkout-modal");

  if (!modal) return;

  modal.classList.remove("show");
  modal.classList.remove("active");
}

function updateCheckoutTotals() {
  const subtotal =
    getCartSubtotal();

  const delivery =
    calculateDelivery();

  const total =
    subtotal + delivery;

  const subtotalElements =
    document.querySelectorAll(
      "#checkoutSubtotal, .checkout-subtotal"
    );

  subtotalElements.forEach(element => {
    element.textContent = money(subtotal);
  });

  const deliveryElements =
    document.querySelectorAll(
      "#checkoutDelivery, .checkout-delivery, #checkoutDeliveryCharge"
    );

  deliveryElements.forEach(element => {
    element.textContent = money(delivery);
  });

  const totalElements =
    document.querySelectorAll(
      "#checkoutTotal, .checkout-total"
    );

  totalElements.forEach(element => {
    element.textContent = money(total);
  });
}

function getCheckoutData() {
  const nameInput =
    document.querySelector("#customerName");

  const phoneInput =
    document.querySelector("#customerPhone");

  const addressInput =
    document.querySelector("#customerAddress");

  const noteInput =
    document.querySelector("#customerNote");

  return {
    name: nameInput
      ? nameInput.value.trim()
      : "",

    phone: phoneInput
      ? phoneInput.value.trim()
      : "",

    address: addressInput
      ? addressInput.value.trim()
      : "",

    note: noteInput
      ? noteInput.value.trim()
      : "",

    payment:
      getSelectedPaymentMethod()
  };
}

// ============================================================
// PLACE ORDER
// ============================================================

async function placeOrder() {
  if (!cart.length) {
    alert("আপনার কার্ট খালি।");
    return;
  }

  const data =
    getCheckoutData();

  if (!data.name) {
    alert("আপনার নাম দিন।");
    return;
  }

  if (!data.phone) {
    alert("আপনার ফোন নম্বর দিন।");
    return;
  }

  if (!data.address) {
    alert("আপনার ঠিকানা দিন।");
    return;
  }

  if (!data.payment) {
    alert("একটি payment method নির্বাচন করুন।");
    return;
  }

  const subtotal =
    getCartSubtotal();

  const delivery =
    calculateDelivery();

  const total =
    subtotal + delivery;

  const orderItems =
    cart.map(item => ({
      id: item.id,
      name: item.name,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      image: item.image || ""
    }));

 const orderPayload = {
  id: crypto.randomUUID(),

  customer_name: String(data.name || "").trim(),
  phone: String(data.phone || "").trim(),
  address: String(data.address || "").trim(),

  items: orderItems,

  subtotal: Number(subtotal) || 0,
  delivery_charge: Number(delivery) || 0,
  total: Number(total) || 0,

  payment_method: data.payment
    ? String(data.payment).trim()
    : null,

  note: data.note
    ? String(data.note).trim()
    : null,

  status: "pending"
};

const button =
  document.querySelector("#placeOrderBtn");

const originalButtonText =
  button ? button.textContent : "";

try {
  if (button) {
    button.disabled = true;
    button.textContent = "অর্ডার করা হচ্ছে...";
  }

  console.log(
    "Creating order:",
    orderPayload
  );

  // CUSTOMER NAME CHECK
  if (!orderPayload.customer_name) {
    alert("দয়া করে আপনার নাম লিখুন.");

    if (button) {
      button.disabled = false;
      button.textContent =
        originalButtonText;
    }

    return;
  }

  // PHONE CHECK
  if (!orderPayload.phone) {
    alert("দয়া করে আপনার ফোন নম্বর দিন.");

    if (button) {
      button.disabled = false;
      button.textContent =
        originalButtonText;
    }

    return;
  }

  // ADDRESS CHECK
  if (!orderPayload.address) {
    alert("দয়া করে আপনার ঠিকানা দিন.");

    if (button) {
      button.disabled = false;
      button.textContent =
        originalButtonText;
    }

    return;
  }

  // INSERT ORDER
  const { error } =
    await supabaseClient
      .from("orders")
      .insert(orderPayload);

  if (error) {
    console.error(
      "Order insert error:",
      error
    );

    alert(
      "অর্ডার করা যায়নি.\n\n" +
      error.message
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        originalButtonText;
    }

    return;
  }

  // ORDER OBJECT
  // ID IS ALREADY GENERATED ABOVE
  const order = {
    ...orderPayload
  };

  console.log(
    "Order created:",
    order
  );

  // CREATE WHATSAPP MESSAGE
  // BEFORE CART IS CLEARED
  const whatsappMessage =
    createWhatsAppMessage(
      order,
      data
    );

  // CLEAR CART
  cart = [];

  saveCart();
  renderCart();
  updateCartUI();

  // CLOSE CHECKOUT
  closeCheckout();

  // SHOW SUCCESS
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
    "অর্ডার করার সময় সমস্যা হয়েছে.\n\n" +
    (error.message || error)
  );

} finally {
  if (button) {
    button.disabled = false;

    button.textContent =
      originalButtonText ||
      "অর্ডার করুন";
  }
}

// ============================================================
// WHATSAPP MESSAGE
// ============================================================

function createWhatsAppMessage(
  order,
  customerData
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
    `👤 নাম: ${customerData.name}`
  );

  lines.push(
    `📞 ফোন: ${customerData.phone}`
  );

  lines.push(
    `📍 ঠিকানা: ${customerData.address}`
  );

  lines.push("");

  lines.push(
    "🛒 *পণ্য:*"
  );

  cart.forEach((item, index) => {
    const quantity =
      Number(item.quantity) || 1;

    const price =
      Number(item.price) || 0;

    const itemTotal =
      price * quantity;

    lines.push(
      `${index + 1}. ${item.name} × ${quantity} = ${money(itemTotal)}`
    );
  });

  // Use order.items if cart was already changed
  if (
    !cart.length &&
    Array.isArray(order?.items)
  ) {
    order.items.forEach(
      (item, index) => {
        const quantity =
          Number(item.quantity) || 1;

        const price =
          Number(item.price) || 0;

        const itemTotal =
          price * quantity;

        lines.push(
          `${index + 1}. ${item.name} × ${quantity} = ${money(itemTotal)}`
        );
      }
    );
  }

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
    `💳 Payment: ${customerData.payment || order.payment_method || "N/A"}`
  );

  if (customerData.note) {
    lines.push(
      `📝 Note: ${customerData.note}`
    );
  }

  return lines.join("\n");
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

      whatsappButton.onclick = () => {
        const url =
          "https://wa.me/" +
          number +
          "?text=" +
          encodeURIComponent(
            whatsappMessage || ""
          );

        window.open(
          url,
          "_blank"
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

  modal.classList.add("show");
  modal.classList.add("active");
}

function closeSuccessModal() {
  const modal =
    document.querySelector(
      "#successModal"
    ) ||
    document.querySelector(
      ".success-modal"
    );

  if (!modal) return;

  modal.classList.remove("show");
  modal.classList.remove("active");
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

  if (!input) return;

  currentSearch =
    input.value || "";

  renderProducts();
}

function clearSearch() {
  currentSearch = "";

  const inputs =
    document.querySelectorAll(
      "#searchInput, .search-input"
    );

  inputs.forEach(input => {
    input.value = "";
  });

  renderProducts();
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

  // CART BUTTON
  const cartButtons =
    document.querySelectorAll(
      "#cartBtn, .cart-btn, [data-open-cart]"
    );

  cartButtons.forEach(button => {
    button.addEventListener(
      "click",
      openCart
    );
  });

  // CHECKOUT BUTTON
  const checkoutButtons =
    document.querySelectorAll(
      "#checkoutBtn, .checkout-btn, [data-open-checkout]"
    );

  checkoutButtons.forEach(button => {
    button.addEventListener(
      "click",
      openCheckout
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
      placeOrder
    );
  }

  // CLOSE BUTTONS
  const closeCartButtons =
    document.querySelectorAll(
      "#closeCartBtn, .close-cart, [data-close-cart]"
    );

  closeCartButtons.forEach(button => {
    button.addEventListener(
      "click",
      closeCart
    );
  });

  const closeCheckoutButtons =
    document.querySelectorAll(
      "#closeCheckoutBtn, .close-checkout, [data-close-checkout]"
    );

  closeCheckoutButtons.forEach(button => {
    button.addEventListener(
      "click",
      closeCheckout
    );
  });

  const closeProductButtons =
    document.querySelectorAll(
      "#closeProductModal, .close-product-modal"
    );

  closeProductButtons.forEach(button => {
    button.addEventListener(
      "click",
      closeProductModal
    );
  });

  const closeSuccessButtons =
    document.querySelectorAll(
      "#closeSuccessModal, .close-success-modal"
    );

  closeSuccessButtons.forEach(button => {
    button.addEventListener(
      "click",
      closeSuccessModal
    );
  });

  // UPDATE CHECKOUT WHEN PAYMENT CHANGES
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
  updateCheckoutTotals();

  // STORE NAME
  const storeName =
    getSettingValue(
      "store_name",
      "name",
      "business_name"
    );

  if (storeName) {
    const nameElements =
      document.querySelectorAll(
        "#storeName, .store-name"
      );

    nameElements.forEach(
      element => {
        element.textContent =
          storeName;
      }
    );
  }

  // STORE LOGO
  const logo =
    getSettingValue(
      "logo_url",
      "logo",
      "store_logo"
    );

  if (logo) {
    const logoElements =
      document.querySelectorAll(
        "#storeLogo, .store-logo"
      );

    logoElements.forEach(
      element => {
        if (
          element.tagName ===
          "IMG"
        ) {
          element.src = logo;
        }
      }
    );
  }
}

// ============================================================
// COMPATIBILITY FUNCTIONS
// ============================================================

function renderProductGrid() {
  renderProducts();
}

function displayProducts() {
  renderProducts();
}

function closeModal() {
  closeProductModal();
  closeCart();
  closeCheckout();
  closeSuccessModal();
}

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

window.renderProducts =
  renderProducts;

window.renderProductGrid =
  renderProductGrid;

window.displayProducts =
  displayProducts;

window.closeModal =
  closeModal;

// ============================================================
// END PART 2
// ============================================================// ============================================================
// MONA VARIETY STORE - APP.JS
// PART 3 / 3
// ============================================================

// ============================================================
// EXTRA UI HELPERS
// ============================================================

function refreshProductDisplay() {
  renderProducts();
  updateCartUI();
  renderCart();
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
}

// ============================================================
// OUTSIDE CLICK HANDLING
// ============================================================

document.addEventListener("click", event => {
  const target = event.target;

  // PRODUCT MODAL CLOSE
  const productModal =
    document.querySelector("#productModal") ||
    document.querySelector(".product-modal");

  if (
    productModal &&
    target === productModal
  ) {
    closeProductModal();
  }

  // CART MODAL CLOSE
  const cartModal =
    document.querySelector("#cartModal") ||
    document.querySelector(".cart-modal");

  if (
    cartModal &&
    target === cartModal
  ) {
    closeCart();
  }

  // CHECKOUT MODAL CLOSE
  const checkoutModal =
    document.querySelector("#checkoutModal") ||
    document.querySelector(".checkout-modal");

  if (
    checkoutModal &&
    target === checkoutModal
  ) {
    closeCheckout();
  }

  // SUCCESS MODAL CLOSE
  const successModal =
    document.querySelector("#successModal") ||
    document.querySelector(".success-modal");

  if (
    successModal &&
    target === successModal
  ) {
    closeSuccessModal();
  }
});

// ============================================================
// ESC KEY
// ============================================================

document.addEventListener(
  "keydown",
  event => {
    if (event.key !== "Escape") {
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
    updateCheckoutTotals();
  }
);

// ============================================================
// HANDLE PAGE VISIBILITY
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
    }
  }
);

// ============================================================
// IMAGE FALLBACK
// ============================================================

document.addEventListener(
  "error",
  event => {
    const element =
      event.target;

    if (
      element &&
      element.tagName === "IMG"
    ) {
      if (
        element.classList.contains(
          "product-image"
        ) ||
        element.closest(
          ".product-image"
        )
      ) {
        element.style.display =
          "none";
      }
    }
  },
  true
);

// ============================================================
// NUMBER FORMAT
// ============================================================

function formatNumber(value) {
  const number =
    Number(value) || 0;

  return number.toLocaleString(
    "en-BD"
  );
}

// ============================================================
// PRODUCT LOOKUP
// ============================================================

function getProductById(id) {
  return products.find(
    product =>
      String(product.id) ===
      String(id)
  );
}

// ============================================================
// CART ITEM LOOKUP
// ============================================================

function getCartItemById(id) {
  return cart.find(
    item =>
      String(item.id) ===
      String(id)
  );
}

// ============================================================
// CHECKOUT VALIDATION
// ============================================================

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
// SAFE WHATSAPP OPEN
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
// STORE CONTACT
// ============================================================

function getStorePhone() {
  return normalizePhone(
    getSettingValue(
      "phone",
      "phone_number",
      "mobile",
      "contact_phone"
    ) || ""
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

  if (whatsapp) {
    document
      .querySelectorAll(
        'a[href*="wa.me"], [data-whatsapp]'
      )
      .forEach(link => {
        link.href =
          "https://wa.me/" +
          whatsapp;
      });
  }

  if (phone) {
    document
      .querySelectorAll(
        'a[href^="tel:"], [data-phone]'
      )
      .forEach(link => {
        link.href =
          "tel:" +
          phone;
      });
  }

  if (facebook) {
    document
      .querySelectorAll(
        '[data-facebook]'
      )
      .forEach(link => {
        link.href =
          facebook;
      });
  }

  if (tiktok) {
    document
      .querySelectorAll(
        '[data-tiktok]'
      )
      .forEach(link => {
        link.href =
          tiktok;
      });
  }
}

// ============================================================
// UPDATE STORE CONTACT AFTER SETTINGS LOAD
// ============================================================

setTimeout(() => {
  try {
    updateContactLinks();
  } catch (error) {
    console.warn(
      "Contact link update error:",
      error
    );
  }
}, 1500);

// ============================================================
// WINDOW RESIZE
// ============================================================

window.addEventListener(
  "resize",
  () => {
    // Keep this lightweight.
    // No unnecessary re-render on resize.
  }
);

// ============================================================
// DEBUG HELPERS
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
  }
};

// ============================================================
// FINAL INITIALIZATION CHECK
// ============================================================

console.log(
  "Mona Variety Store app.js loaded successfully."
);

// ============================================================
// END OF APP.JS
// ============================================================
/* ============================================================
   FINAL FIX - CART + OLD PRICE + WHATSAPP
   ============================================================ */

(function () {

  // ---------- CART DRAWER FIX ----------
  window.openCart = function () {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");

    if (!drawer) {
      console.error("cartDrawer not found");
      return;
    }

    if (typeof renderCart === "function") {
      renderCart();
    }

    drawer.classList.add("open");

    if (overlay) {
      overlay.classList.add("show");
    }

    document.body.style.overflow = "hidden";
  };


  window.closeCart = function () {
    const drawer = document.getElementById("cartDrawer");
    const overlay = document.getElementById("cartOverlay");

    if (drawer) {
      drawer.classList.remove("open");
    }

    if (overlay) {
      overlay.classList.remove("show");
    }

    document.body.style.overflow = "";
  };


  // ---------- CART OVERLAY ----------
  document.addEventListener("click", function (event) {

    if (event.target.id === "cartOverlay") {
      window.closeCart();
    }

  });


  // ---------- OLD PRICE STRIKE ----------
  const style = document.createElement("style");

  style.textContent = `
    .old-price {
      color: #999 !important;
      text-decoration: line-through !important;
      text-decoration-thickness: 1.5px !important;
      margin-left: 6px;
      font-size: 13px;
      font-weight: 400;
    }

    .product-old-price {
      text-decoration: line-through !important;
    }

    #cartDrawer {
      z-index: 1000 !important;
    }

    #cartOverlay {
      z-index: 999 !important;
    }
  `;

  document.head.appendChild(style);


  // ---------- WHATSAPP NUMBER ----------
  window.getWhatsAppNumber = function () {
    return "8801913726867";
  };


  // ---------- FORCE WHATSAPP LINKS ----------
  document.addEventListener("DOMContentLoaded", function () {

    document.querySelectorAll(
      'a[href*="wa.me"], a[href*="whatsapp"]'
    ).forEach(function (link) {

      const currentHref = link.getAttribute("href") || "";

      if (
        currentHref.includes("wa.me") ||
        currentHref.includes("whatsapp")
      ) {
        const parts = currentHref.split("?text=");

        let newHref =
          "https://wa.me/8801913726867";

        if (parts[1]) {
          newHref += "?text=" + parts[1];
        }

        link.setAttribute("href", newHref);
      }

    });

  });

})();

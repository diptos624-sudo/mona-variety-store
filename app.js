// ==========================================
// MONA VARIETY STORE
// app.js — FINAL VERSION
// ==========================================


// ==========================================
// SUPABASE
// ==========================================

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);


// ==========================================
// GLOBAL VARIABLES
// ==========================================

let storeSettings = {};
let categories = [];
let products = [];
let paymentMethods = [];

let cart = [];
let currentCategory = "all";
let currentSearch = "";
let selectedProduct = null;


// ==========================================
// START APP
// ==========================================

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


// ==========================================
// BASIC EVENTS
// ==========================================

function bindEvents() {

  const searchBtn =
    document.getElementById("searchBtn");

  const searchInput =
    document.getElementById("productSearchInput");

  const cartBtn =
    document.getElementById("cartBtn");

  const closeCartBtn =
    document.getElementById("closeCartBtn");

  const cartOverlay =
    document.getElementById("cartOverlay");

  const shopBtn =
    document.getElementById("shopNowBtn");


  // SEARCH BUTTON
  if (searchBtn) {

    searchBtn.addEventListener(
      "click",
      searchProducts
    );

  }


  // SEARCH ENTER
  if (searchInput) {

    searchInput.addEventListener(
      "keydown",
      e => {

        if (e.key === "Enter") {

          searchProducts();

        }

      }
    );

  }


  // CART OPEN
  if (cartBtn) {

    cartBtn.addEventListener(
      "click",
      openCart
    );

  }


  // CART CLOSE BUTTON
  if (closeCartBtn) {

    closeCartBtn.addEventListener(
      "click",
      closeCart
    );

  }


  // CART OVERLAY CLOSE
  if (cartOverlay) {

    cartOverlay.addEventListener(
      "click",
      closeCart
    );

  }


  // SHOP NOW
  if (shopBtn) {

    shopBtn.addEventListener(
      "click",
      () => {

        document
          .getElementById("productsSection")
          ?.scrollIntoView({
            behavior: "smooth"
          });

      }
    );

  }

}


// ==========================================
// LOAD STORE SETTINGS
// ==========================================

async function loadStoreSettings() {

  const { data, error } =
    await supabaseClient
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle();


  if (error) {

    console.error(
      "Store Settings Error:",
      error
    );

    return;

  }


  storeSettings = data || {};

  applyStoreSettings();

}


// ==========================================
// APPLY STORE SETTINGS
// ==========================================

function applyStoreSettings() {

  setText(
    "headerStoreName",
    storeSettings.store_name ||
    "মনা ভ্যারাইটি স্টোর"
  );


  setText(
    "headerTagline",
    storeSettings.tagline || ""
  );


  setText(
    "heroStoreName",
    storeSettings.store_name ||
    "মনা ভ্যারাইটি স্টোর"
  );


  setText(
    "heroTagline",
    storeSettings.tagline || ""
  );


  setText(
    "footerStoreName",
    storeSettings.store_name ||
    "মনা ভ্যারাইটি স্টোর"
  );


  setText(
    "footerTagline",
    storeSettings.tagline || ""
  );


  setText(
    "footerPhone",
    storeSettings.phone ||
    "01913726867"
  );


  setText(
    "footerAddress",
    storeSettings.address || ""
  );


  // LOGO
  const logo =
    document.getElementById("headerLogo");


  if (
    logo &&
    storeSettings.logo_url
  ) {

    logo.src =
      storeSettings.logo_url;

  }


  // WHATSAPP
  const whatsapp =
    document.getElementById("heroWhatsapp");


  if (whatsapp) {

    whatsapp.href =
      "https://wa.me/" +
      normalizePhone(
        storeSettings.whatsapp ||
        storeSettings.phone ||
        "01913726867"
      );

  }


  // FACEBOOK
  const facebook =
    document.getElementById("footerFacebook");


  if (
    facebook &&
    storeSettings.facebook_url
  ) {

    facebook.href =
      storeSettings.facebook_url;

  }


  // TIKTOK
  const tiktok =
    document.getElementById("footerTikTok");


  if (
    tiktok &&
    storeSettings.tiktok_url
  ) {

    tiktok.href =
      storeSettings.tiktok_url;

  }


  setText(
    "footerYear",
    new Date().getFullYear()
  );

}


// ==========================================
// TEXT HELPER
// ==========================================

function setText(id, value) {

  const el =
    document.getElementById(id);

  if (el) {

    el.textContent =
      value ?? "";

  }

}


// ==========================================
// PHONE HELPER
// ==========================================

function normalizePhone(phone) {
    let number = String(phone || "").replace(/\D/g, "");

    if (number.startsWith("880")) {
        return number;
    }

    if (number.startsWith("0")) {
        return "88" + number;
    }

    if (number.startsWith("88")) {
        return number;
    }

    return "88" + number;
}


// ==========================================
// CATEGORY + PRODUCT
// ==========================================


// ==========================================
// LOAD CATEGORIES
// ==========================================

async function loadCategories() {

  const { data, error } =
    await supabaseClient
      .from("categories")
      .select("*")
      .order("name", {
        ascending: true
      });


  if (error) {

    console.error(
      "Category Error:",
      error
    );

    return;

  }


  categories = data || [];

  renderCategories();

}


// ==========================================
// RENDER CATEGORIES
// ==========================================

function renderCategories() {

  const box =
    document.getElementById(
      "categoryList"
    );


  if (!box) return;


  let html = `
    <button
      class="category-btn active"
      onclick="filterCategory('all')">
      🛍️ সব পণ্য
    </button>
  `;


  categories.forEach(category => {

    html += `
      <button
        class="category-btn"
        onclick="filterCategory('${escapeHtml(category.name)}')">

        <span>
          ${escapeHtml(
            category.icon || "🛍️"
          )}
        </span>

        ${escapeHtml(category.name)}

      </button>
    `;

  });


  box.innerHTML =
    html;

}


// ==========================================
// CATEGORY FILTER
// ==========================================

function filterCategory(name) {

  currentCategory =
    name;


  document
    .querySelectorAll(".category-btn")
    .forEach(btn => {

      btn.classList.remove(
        "active"
      );

    });


  document
    .querySelectorAll(".category-btn")
    .forEach(btn => {

      if (
        btn.textContent
          .trim()
          .includes(
            name === "all"
              ? "সব পণ্য"
              : name
          )
      ) {

        btn.classList.add(
          "active"
        );

      }

    });


  renderAll();

}


// ==========================================
// LOAD PRODUCTS
// ==========================================

async function loadProducts() {

  const { data, error } =
    await supabaseClient
      .from("products")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {

    console.error(
      "Product Error:",
      error
    );

    products = [];

    alert(
      "Product Error: " +
      error.message
    );

    return;
  }

  products = data || [];

  alert(
    "Products found: " +
    products.length
  );

  console.log(
    "Products loaded:",
    products
  );

  if (typeof renderProducts === "function") {
    renderProducts();
  }

  if (typeof renderProductGrid === "function") {
    renderProductGrid();
  }

  if (typeof displayProducts === "function") {
    displayProducts();
  }
}

  if (error) {

    console.error(
      "Product Error:",
      error
    );

    return;

  }


  products =
    data || [];

}


// ==========================================
// LOAD PAYMENT METHODS
// ==========================================

async function loadPaymentMethods() {

  const { data, error } =
    await supabaseClient
      .from("payment_methods")
      .select("*")
      .eq("active", true)
      .order("name", {
        ascending: true
      });


  if (error) {

    console.error(
      "Payment Error:",
      error
    );

    paymentMethods = [];

    return;

  }


  paymentMethods =
    data || [];

}


// ==========================================
// RENDER ALL
// ==========================================

function renderAll() {

  renderCategories();

  renderProducts();

  renderFeaturedProducts();

}


// ==========================================
// FILTER PRODUCTS
// ==========================================

function getFilteredProducts() {

  let list =
    [...products];


  // CATEGORY
  if (
    currentCategory !== "all"
  ) {

    list =
      list.filter(product =>
        String(
          product.category || ""
        )
          .toLowerCase() ===
        String(
          currentCategory
        )
          .toLowerCase()
      );

  }


  // SEARCH
  if (currentSearch) {

    const search =
      currentSearch.toLowerCase();


    list =
      list.filter(product => {

        const name =
          String(
            product.name || ""
          )
            .toLowerCase();


        const category =
          String(
            product.category || ""
          )
            .toLowerCase();


        return (
          name.includes(search) ||
          category.includes(search)
        );

      });

  }


  return list;

}


// ==========================================
// RENDER PRODUCTS
// ==========================================

function renderProducts() {

  const grid =
    document.getElementById(
      "productGrid"
    );


  if (!grid) return;


  const list =
    getFilteredProducts();


  if (!list.length) {

    grid.innerHTML = `
      <div class="empty-products">

        <h3>
          😔 কোনো পণ্য পাওয়া যায়নি
        </h3>

        <p>
          অন্য কিছু লিখে আবার চেষ্টা করুন।
        </p>

      </div>
    `;

    return;

  }


  grid.innerHTML =
    list
      .map(productCard)
      .join("");

}


// ==========================================
// FEATURED PRODUCTS
// ==========================================

function renderFeaturedProducts() {

  const section =
    document.getElementById(
      "featuredSection"
    );


  const grid =
    document.getElementById(
      "featuredProducts"
    );


  if (!grid) return;


  const featured =
    products.filter(product =>
      product.featured === true ||
      product.is_featured === true
    );


  if (!featured.length) {

    if (section) {

      section.style.display =
        "none";

    }

    return;

  }


  if (section) {

    section.style.display =
      "";

  }


  grid.innerHTML =
    featured
      .slice(0, 8)
      .map(productCard)
      .join("");

}


// ==========================================
// PRODUCT CARD
// ==========================================

function productCard(product) {

  const price =
    Number(
      product.price || 0
    );


  const oldPrice =
    Number(
      product.old_price || 0
    );


  const stock =
    Number(
      product.stock || 0
    );


  const image =
    product.image_url || "";


  let badge =
    "";


  if (product.discount) {

    badge = `
      <span class="product-badge">
        ${escapeHtml(
          product.discount
        )}
      </span>
    `;

  }

  else if (
    product.is_new === true
  ) {

    badge = `
      <span class="product-badge">
        নতুন
      </span>
    `;

  }

  else if (
    product.best_seller === true
  ) {

    badge = `
      <span class="product-badge">
        বেস্ট সেলার
      </span>
    `;

  }


  return `
    <article
      class="product-card"
      onclick="openProductModal('${product.id}')">

      <div class="product-image-wrap">

        ${badge}

        <img
          src="${escapeHtml(image)}"
          alt="${escapeHtml(
            product.name || ""
          )}"
          loading="lazy"
        >

      </div>


      <div class="product-info">

        <small>
          ${escapeHtml(
            product.category || ""
          )}
        </small>


        <h3>
          ${escapeHtml(
            product.name || ""
          )}
        </h3>


        <div class="product-price">

          <strong>
            ৳${formatMoney(price)}
          </strong>

          ${
            oldPrice > price
              ? `
                <del>
                  ৳${formatMoney(
                    oldPrice
                  )}
                </del>
              `
              : ""
          }

        </div>


        <div class="stock-text">

          ${
            stock > 0
              ? `স্টকে আছে (${stock})`
              : "স্টক শেষ"
          }

        </div>

      </div>

    </article>
  `;

}


// ==========================================
// SEARCH
// ==========================================

function searchProducts() {

  const input =
    document.getElementById(
      "productSearchInput"
    );


  currentSearch =
    input
      ? input.value.trim()
      : "";


  renderProducts();


  document
    .getElementById(
      "productsSection"
    )
    ?.scrollIntoView({
      behavior: "smooth"
    });

}


// ==========================================
// MONEY FORMAT
// ==========================================

function formatMoney(amount) {

  return Number(
    amount || 0
  )
    .toLocaleString(
      "en-US"
    );

}


// ==========================================
// HTML SECURITY
// ==========================================

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


// ==========================================
// MESSAGE
// ==========================================

function showMessage(
  id,
  message
) {

  const el =
    document.getElementById(id);


  if (!el) return;


  el.textContent =
    message;

}


// ==========================================
// CART SYSTEM 🛒
// ==========================================


// ==========================================
// LOAD CART
// ==========================================

function loadCart() {

  try {

    cart =
      JSON.parse(
        localStorage.getItem(
          "monaCart"
        )
      ) || [];

  }

  catch (error) {

    cart = [];

  }

}


// ==========================================
// SAVE CART
// ==========================================

function saveCart() {

  localStorage.setItem(
    "monaCart",
    JSON.stringify(cart)
  );


  updateCartUI();

}


// ==========================================
// ADD TO CART
// ==========================================

function addToCart(id) {

  const product =
    products.find(
      p =>
        String(p.id) ===
        String(id)
    );


  if (!product) return;


  const stock =
    Number(
      product.stock || 0
    );


  if (stock <= 0) {

    alert(
      "দুঃখিত, পণ্যটি স্টকে নেই।"
    );

    return;

  }


  const existing =
    cart.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (existing) {

    if (
      existing.quantity >=
      stock
    ) {

      alert(
        "স্টকের বেশি নেওয়া যাবে না।"
      );

      return;

    }


    existing.quantity++;

  }

  else {

    cart.push({

      id:
        product.id,

      name:
        product.name,

      price:
        Number(
          product.price || 0
        ),

      image:
        product.image_url ||
        product.image ||
        "",

      quantity:
        1,

      stock:
        stock

    });

  }


  saveCart();

  openCart();

}


// ==========================================
// CHANGE QUANTITY
// ==========================================

function changeQuantity(
  id,
  change
) {

  const item =
    cart.find(
      p =>
        String(p.id) ===
        String(id)
    );


  if (!item) return;


  item.quantity +=
    change;


  if (
    item.quantity <= 0
  ) {

    cart =
      cart.filter(
        p =>
          String(p.id) !==
          String(id)
      );

  }


  if (
    item.quantity > 0 &&
    item.quantity >
      Number(
        item.stock || 999999
      )
  ) {

    item.quantity =
      Number(
        item.stock
      );


    alert(
      "স্টকের বেশি নেওয়া যাবে না।"
    );

  }


  saveCart();

  renderCart();

}


// ==========================================
// REMOVE FROM CART
// ==========================================

function removeFromCart(id) {

  cart =
    cart.filter(
      item =>
        String(item.id) !==
        String(id)
    );


  saveCart();

  renderCart();

}


// ==========================================
// CART SUBTOTAL
// ==========================================

function getCartSubtotal() {

  return cart.reduce(
    (
      total,
      item
    ) =>
      total +
      Number(
        item.price || 0
      ) *
      Number(
        item.quantity || 0
      ),
    0
  );

}


// ==========================================
// DELIVERY
// ==========================================

function calculateDelivery() {

  const subtotal =
    getCartSubtotal();


  const charge =
    Number(
      storeSettings.delivery_charge ||
      0
    );


  const free =
    Number(
      storeSettings.free_delivery_min ||
      0
    );


  if (
    free > 0 &&
    subtotal >= free
  ) {

    return 0;

  }


  return charge;

}


// ==========================================
// UPDATE CART UI
// ==========================================

function updateCartUI() {

  const count =
    cart.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.quantity || 0
        ),
      0
    );


  const cartCount =
    document.getElementById(
      "cartCount"
    );


  if (cartCount) {

    cartCount.textContent =
      count;

  }


  renderCart();

}


// ==========================================
// RENDER CART
// ==========================================

function renderCart() {

  const box =
    document.getElementById(
      "cartItems"
    );


  if (!box) return;


  if (!cart.length) {

    box.innerHTML = `
      <div class="empty-cart">

        🛒<br>

        আপনার কার্ট খালি

      </div>
    `;

  }

  else {

    box.innerHTML =
      cart
        .map(cartItemHTML)
        .join("");

  }


  const subtotal =
    getCartSubtotal();


  const delivery =
    calculateDelivery();


  const total =
    subtotal +
    delivery;


  setText(
    "cartSubtotal",
    "৳" +
    formatMoney(
      subtotal
    )
  );


  setText(
    "cartDelivery",
    delivery === 0
      ? "ফ্রি"
      : "৳" +
        formatMoney(
          delivery
        )
  );


  setText(
    "cartTotal",
    "৳" +
    formatMoney(
      total
    )
  );


  const checkout =
    document.getElementById(
      "checkoutBtn"
    );


  if (checkout) {

    checkout.disabled =
      cart.length === 0;

  }

}


// ==========================================
// CART ITEM HTML
// ==========================================

function cartItemHTML(item) {

  return `
    <div class="cart-item">

      <img
        src="${escapeHtml(
          item.image || ""
        )}"
        alt="${escapeHtml(
          item.name
        )}"
      >


      <div class="cart-item-info">

        <h4>
          ${escapeHtml(
            item.name
          )}
        </h4>


        <strong>
          ৳${formatMoney(
            item.price
          )}
        </strong>


        <div class="quantity-control">

          <button
            onclick="changeQuantity(
              '${item.id}',
              -1
            )">

            −

          </button>


          <span>
            ${item.quantity}
          </span>


          <button
            onclick="changeQuantity(
              '${item.id}',
              1
            )">

            +

          </button>

        </div>

      </div>


      <button
        class="remove-cart"
        onclick="removeFromCart(
          '${item.id}'
        )">

        ×

      </button>

    </div>
  `;

}


// ==========================================
// OPEN CART
// ==========================================

function openCart() {

  renderCart();


  const overlay =
    document.getElementById(
      "cartOverlay"
    );


  const drawer =
    document.getElementById(
      "cartDrawer"
    );


  if (overlay) {

    overlay.classList.add(
      "show"
    );

  }


  if (drawer) {

    // IMPORTANT:
    // CSS uses .cart-drawer.open
    drawer.classList.add(
      "open"
    );

  }

}


// ==========================================
// CLOSE CART
// ==========================================

function closeCart() {

  const overlay =
    document.getElementById(
      "cartOverlay"
    );


  const drawer =
    document.getElementById(
      "cartDrawer"
    );


  if (overlay) {

    overlay.classList.remove(
      "show"
    );

  }


  if (drawer) {

    // IMPORTANT:
    // CSS uses .cart-drawer.open
    drawer.classList.remove(
      "open"
    );

  }

}


// ==========================================
// CHECKOUT + PAYMENT
// ==========================================


// ==========================================
// OPEN CHECKOUT
// ==========================================

function openCheckout() {

  if (!cart.length) {

    alert(
      "আপনার কার্ট খালি।"
    );

    return;

  }


  closeCart();

  renderCheckoutPayment();

  renderCheckoutSummary();


  const modal =
    document.getElementById(
      "checkoutModal"
    );


  if (modal) {

    modal.classList.add(
      "show"
    );

  }

}


// ==========================================
// CLOSE CHECKOUT
// ==========================================

function closeCheckout() {

  const modal =
    document.getElementById(
      "checkoutModal"
    );


  if (modal) {

    modal.classList.remove(
      "show"
    );

  }

}


// ==========================================
// PAYMENT METHODS
// ==========================================

function renderCheckoutPayment() {

  const box =
    document.getElementById(
      "checkoutPaymentMethods"
    );


  if (!box) return;


  if (
    !paymentMethods.length
  ) {

    box.innerHTML = `
      <p>
        পেমেন্ট মেথড পাওয়া যায়নি।
      </p>
    `;

    return;

  }


  box.innerHTML =
    paymentMethods
      .map(
        (
          payment,
          index
        ) => {

          return `
            <label
              class="payment-option">

              <input
                type="radio"
                name="paymentMethod"
                value="${escapeHtml(
                  payment.name || ""
                )}"
                ${
                  index === 0
                    ? "checked"
                    : ""
                }
              >

              <span>
                ${escapeHtml(
                  payment.name ||
                  "Payment"
                )}
              </span>

              ${
                payment.number
                  ? `
                    <small>
                      ${escapeHtml(
                        payment.number
                      )}
                    </small>
                  `
                  : ""
              }

            </label>
          `;

        }
      )
      .join("");

}


// ==========================================
// CHECKOUT SUMMARY
// ==========================================

function renderCheckoutSummary() {

  const box =
    document.getElementById(
      "checkoutSummary"
    );


  if (!box) return;


  box.innerHTML =
    cart
      .map(
        item => {

          return `
            <div
              class="checkout-item">

              <span>
                ${escapeHtml(
                  item.name
                )}
                × ${item.quantity}
              </span>

              <strong>
                ৳${formatMoney(
                  item.price *
                  item.quantity
                )}
              </strong>

            </div>
          `;

        }
      )
      .join("");


  const subtotal =
    getCartSubtotal();


  const delivery =
    calculateDelivery();


  const total =
    subtotal +
    delivery;


  setText(
    "checkoutSubtotal",
    "৳" +
    formatMoney(
      subtotal
    )
  );


  setText(
    "checkoutDelivery",
    delivery === 0
      ? "ফ্রি"
      : "৳" +
        formatMoney(
          delivery
        )
  );


  setText(
    "checkoutTotal",
    "৳" +
    formatMoney(
      total
    )
  );

}


// ==========================================
// GET SELECTED PAYMENT
// ==========================================

function getSelectedPayment() {

  const selected =
    document.querySelector(
      'input[name="paymentMethod"]:checked'
    );


  return selected
    ? selected.value
    : "";

}


// ==========================================
// CHECKOUT FORM DATA
// ==========================================

function getCheckoutData() {

  return {

    name:
      document
        .getElementById(
          "customerName"
        )
        ?.value
        .trim() || "",


    phone:
      document
        .getElementById(
          "customerPhone"
        )
        ?.value
        .trim() || "",


    address:
      document
        .getElementById(
          "customerAddress"
        )
        ?.value
        .trim() || "",


    note:
      document
        .getElementById(
          "customerNote"
        )
        ?.value
        .trim() || "",


    payment:
      getSelectedPayment()

  };

}


// ==========================================
// VALIDATE CHECKOUT
// ==========================================

function validateCheckout(
  data
) {

  if (!data.name) {

    alert(
      "আপনার নাম লিখুন।"
    );

    return false;

  }


  if (!data.phone) {

    alert(
      "আপনার ফোন নম্বর লিখুন।"
    );

    return false;

  }


  if (!data.address) {

    alert(
      "আপনার ঠিকানা লিখুন।"
    );

    return false;

  }


  if (!data.payment) {

    alert(
      "একটি পেমেন্ট মেথড নির্বাচন করুন।"
    );

    return false;

  }


  return true;

}


// ==========================================
// ORDER SUBMIT
// ==========================================

async function placeOrder() {
    try {
        // ============================================
        // CUSTOMER DATA
        // ============================================

        const name =
            document.getElementById("customerName")?.value?.trim() || "";

        const phone =
            document.getElementById("customerPhone")?.value?.trim() || "";

        const address =
            document.getElementById("customerAddress")?.value?.trim() || "";

        const note =
            document.getElementById("customerNote")?.value?.trim() || "";

        // Payment method
        const paymentRadio =
            document.querySelector(
                'input[name="paymentMethod"]:checked'
            );

        const payment =
            paymentRadio?.value ||
            paymentRadio?.dataset?.name ||
            "";

        // ============================================
        // VALIDATION
        // ============================================

        if (!name) {
            alert("আপনার নাম লিখুন।");
            return;
        }

        if (!phone) {
            alert("আপনার ফোন নম্বর লিখুন।");
            return;
        }

        if (!address) {
            alert("আপনার ঠিকানা লিখুন।");
            return;
        }

        if (!cart || cart.length === 0) {
            alert("আপনার কার্ট খালি।");
            return;
        }

        // ============================================
        // TOTAL
        // ============================================

        const subtotal = cart.reduce(
            (sum, item) =>
                sum +
                (Number(item.price) || 0) *
                    (Number(item.quantity) || 0),
            0
        );

        const delivery = Number(deliveryCharge) || 0;

        const total = subtotal + delivery;

        // ============================================
        // ORDER ITEMS
        // ============================================

        const orderItems = cart.map(item => ({
            id: item.id,
            name: item.name,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 0,
            total:
                (Number(item.price) || 0) *
                (Number(item.quantity) || 0)
        }));

        // ============================================
        // BUTTON LOADING
        // ============================================

        const placeBtn =
            document.getElementById("placeOrderBtn");

        if (placeBtn) {
            placeBtn.disabled = true;
            placeBtn.dataset.oldText =
                placeBtn.innerText;

            placeBtn.innerText =
                "অর্ডার করা হচ্ছে...";
        }

        // ============================================
        // INSERT ORDER
        // ============================================

        const { data: order, error } =
            await supabaseClient
                .from("orders")
                .insert({
                    customer_name: name,
                    phone: phone,
                    address: address,
                    items: orderItems,
                    subtotal: subtotal,
                    delivery_charge: delivery,
                    total: total,
                    payment_method: payment || null,
                    note: note || null,
                    status: "pending"
                })
                .select()
                .single();

        // ============================================
        // ERROR
        // ============================================

        if (error) {

            console.error(
                "ORDER INSERT ERROR:",
                error
            );

            alert(
                "Order Error:\n\n" +
                "Message: " +
                (error.message || "") +
                "\n\nCode: " +
                (error.code || "") +
                "\n\nDetails: " +
                (error.details || "") +
                "\n\nHint: " +
                (error.hint || "")
            );

            if (placeBtn) {
                placeBtn.disabled = false;
                placeBtn.innerText =
                    placeBtn.dataset.oldText ||
                    "অর্ডার কনফার্ম করুন";
            }

            return;
        }

        // ============================================
        // ORDER SUCCESS
        // ============================================

        console.log(
            "ORDER CREATED SUCCESSFULLY:",
            order
        );

        // WhatsApp message
        let whatsappMessage =
            "🛍️ *মনা ভ্যারাইটি স্টোর - নতুন অর্ডার*%0A%0A";

        whatsappMessage +=
            "📦 *Order ID:* " +
            (order.id || "") +
            "%0A";

        whatsappMessage +=
            "👤 *নাম:* " +
            encodeURIComponent(name) +
            "%0A";

        whatsappMessage +=
            "📞 *ফোন:* " +
            encodeURIComponent(phone) +
            "%0A";

        whatsappMessage +=
            "📍 *ঠিকানা:* " +
            encodeURIComponent(address) +
            "%0A%0A";

        whatsappMessage +=
            "🛒 *Products:*%0A";

        orderItems.forEach((item, index) => {

            whatsappMessage +=
                (index + 1) +
                ". " +
                encodeURIComponent(item.name) +
                " × " +
                item.quantity +
                " = ৳" +
                item.total +
                "%0A";
        });

        whatsappMessage +=
            "%0A💰 *Subtotal:* ৳" +
            subtotal;

        whatsappMessage +=
            "%0A🚚 *Delivery:* ৳" +
            delivery;

        whatsappMessage +=
            "%0A💵 *Total:* ৳" +
            total;

        if (payment) {
            whatsappMessage +=
                "%0A💳 *Payment:* " +
                encodeURIComponent(payment);
        }

        if (note) {
            whatsappMessage +=
                "%0A📝 *Note:* " +
                encodeURIComponent(note);
        }

        // ============================================
        // CLEAR CART
        // ============================================

        cart = [];

        localStorage.setItem(
            "cart",
            JSON.stringify(cart)
        );

        // ============================================
        // UPDATE UI
        // ============================================

        if (typeof updateCartUI === "function") {
            updateCartUI();
        }

        if (typeof renderCart === "function") {
            renderCart();
        }

        // Close checkout modal
        const checkoutModal =
            document.getElementById(
                "checkoutModal"
            );

        if (checkoutModal) {
            checkoutModal.classList.remove(
                "active"
            );

            checkoutModal.style.display = "none";
        }

        // ============================================
        // SUCCESS ORDER ID
        // ============================================

        const successOrderId =
            document.getElementById(
                "successOrderId"
            );

        if (successOrderId) {
            successOrderId.innerText =
                order.id || "";
        }

        // ============================================
        // SUCCESS MODAL
        // ============================================

        const successModal =
            document.getElementById(
                "successModal"
            );

        if (successModal) {
            successModal.classList.add(
                "active"
            );

            successModal.style.display =
                "flex";
        }

        // ============================================
        // WHATSAPP BUTTON
        // ============================================

        const whatsappBtn =
            document.getElementById(
                "successWhatsAppBtn"
            );

        if (whatsappBtn) {

            // তোমার WhatsApp number এখানে না থাকলে
            // config.js-এর number ব্যবহার করবে।

            const whatsappNumber =
                window.WHATSAPP_NUMBER ||
                "8801913726867";

            whatsappBtn.onclick = function () {

                const url =
                    "https://wa.me/" +
                    whatsappNumber +
                    "?text=" +
                    whatsappMessage;

                window.open(
                    url,
                    "_blank"
                );
            };
        }

        // ============================================
        // RESTORE BUTTON
        // ============================================

        if (placeBtn) {
            placeBtn.disabled = false;

            placeBtn.innerText =
                placeBtn.dataset.oldText ||
                "অর্ডার কনফার্ম করুন";
        }

    } catch (err) {

        console.error(
            "PLACE ORDER ERROR:",
            err
        );

        alert(
            "অর্ডার দিতে সমস্যা হয়েছে।\n\n" +
            (err?.message || err)
        );

        const placeBtn =
            document.getElementById(
                "placeOrderBtn"
            );

        if (placeBtn) {
            placeBtn.disabled = false;

            placeBtn.innerText =
                placeBtn.dataset.oldText ||
                "অর্ডার কনফার্ম করুন";
        }
    }
}


    return;

  }


  // ========================================
  // CREATE WHATSAPP MESSAGE
  // BEFORE CART CLEAR
  // ========================================

  const whatsappMessage =
    createWhatsAppMessage(
      order,
      data
    );


  // ========================================
  // CLEAR CART
  // ========================================

  cart = [];

  saveCart();

  closeCheckout();


  // ========================================
  // SUCCESS MODAL
  // ========================================

  const orderId =
    order?.id ||
    "N/A";


  setText(
    "successOrderId",
    orderId
  );


  const successModal =
    document.getElementById(
      "successModal"
    );


  if (successModal) {

    successModal.classList.add(
      "show"
    );

  }


  // ========================================
  // WHATSAPP BUTTON
  // ========================================

  const whatsappBtn =
    document.getElementById(
      "successWhatsappBtn"
    );


  if (whatsappBtn) {

    const phone =
      normalizePhone(
        storeSettings.whatsapp ||
        storeSettings.phone ||
        "01913726867"
      );


    whatsappBtn.href =
      "https://wa.me/" +
      phone +
      "?text=" +
      encodeURIComponent(
        whatsappMessage
      );

  }


  if (button) {

    button.disabled =
      false;

    button.textContent =
      "অর্ডার কনফার্ম করুন";

  }

}


// ==========================================
// WHATSAPP ORDER MESSAGE
// ==========================================

function createWhatsAppMessage(
  order,
  customer
) {

  let message =
    "🛍️ *মনা ভ্যারাইটি স্টোর*\n\n";


  message +=
    "📦 নতুন অর্ডার\n";


  message +=
    "🆔 অর্ডার ID: " +
    order.id +
    "\n\n";


  message +=
    "👤 নাম: " +
    customer.name +
    "\n";


  message +=
    "📞 ফোন: " +
    customer.phone +
    "\n";


  message +=
    "📍 ঠিকানা: " +
    customer.address +
    "\n\n";


  message +=
    "🛒 *পণ্য:*\n";


  // IMPORTANT:
  // order.items থেকে নেওয়া হচ্ছে
  // কারণ order দেওয়ার পরে cart clear হয়ে যায়

  const items =
    order.items || [];


  items.forEach(
    item => {

      message +=
        "• " +
        item.name +
        " × " +
        item.quantity +
        " = ৳" +
        formatMoney(
          item.price *
          item.quantity
        ) +
        "\n";

    }
  );


  message +=
    "\n💵 পণ্যের মূল্য: ৳" +
    formatMoney(
      order.subtotal
    );


  message +=
    "\n🚚 ডেলিভারি: " +
    (
      Number(
        order.delivery_charge
      ) === 0
        ? "ফ্রি"
        : "৳" +
          formatMoney(
            order.delivery_charge
          )
    );


  message +=
    "\n💰 *সর্বমোট: ৳" +
    formatMoney(
      order.total
    );


  message +=
    "\n💳 পেমেন্ট: " +
    customer.payment;


  if (customer.note) {

    message +=
      "\n📝 নোট: " +
      customer.note;

  }


  return message;

}


// ==========================================
// QUICK PRODUCT VIEW
// ==========================================

function openProductModal(id) {

  const product =
    products.find(
      p =>
        String(p.id) ===
        String(id)
    );


  if (!product) return;


  selectedProduct =
    product;


  const box =
    document.getElementById(
      "productModalContent"
    );


  if (!box) return;


  const image =
    product.image_url ||
    product.image ||
    "";


  box.innerHTML = `

    <div class="quick-product">

      <img
        src="${escapeHtml(image)}"
        alt="${escapeHtml(
          product.name
        )}"
      >


      <div>

        <small>
          ${escapeHtml(
            product.category || ""
          )}
        </small>


        <h2>
          ${escapeHtml(
            product.name
          )}
        </h2>


        <p>
          ${escapeHtml(
            product.description || ""
          )}
        </p>


        <h3>
          ৳${formatMoney(
            product.price
          )}
        </h3>


        <button
          class="add-cart-btn"
          onclick="
            addToCart('${product.id}');
            closeProductModal();
          ">

          🛒 কার্টে যোগ করুন

        </button>

      </div>

    </div>

  `;


  const modal =
    document.getElementById(
      "productModal"
    );


  if (modal) {

    modal.classList.add(
      "show"
    );

  }

}


// ==========================================
// CLOSE PRODUCT MODAL
// ==========================================

function closeProductModal() {

  const modal =
    document.getElementById(
      "productModal"
    );


  if (modal) {

    modal.classList.remove(
      "show"
    );

  }

}


// ==========================================
// CLOSE SUCCESS MODAL
// ==========================================

function closeSuccessModal() {

  const modal =
    document.getElementById(
      "successModal"
    );


  if (modal) {

    modal.classList.remove(
      "show"
    );

  }

}


// ==========================================
// CONTINUE SHOPPING
// ==========================================

function continueShopping() {

  closeSuccessModal();


  document
    .getElementById(
      "productsSection"
    )
    ?.scrollIntoView({
      behavior: "smooth"
    });

}


// ==========================================
// OTHER BUTTON EVENTS
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    // CHECKOUT
    const checkoutBtn =
      document.getElementById(
        "checkoutBtn"
      );


    if (checkoutBtn) {

      checkoutBtn.addEventListener(
        "click",
        openCheckout
      );

    }


    // PLACE ORDER
    const placeOrderBtn =
      document.getElementById(
        "placeOrderBtn"
      );


    if (placeOrderBtn) {

      placeOrderBtn.addEventListener(
        "click",
        placeOrder
      );

    }


    // CLOSE CHECKOUT
    const closeCheckoutBtn =
      document.getElementById(
        "closeCheckoutBtn"
      );


    if (closeCheckoutBtn) {

      closeCheckoutBtn.addEventListener(
        "click",
        closeCheckout
      );

    }


    // CLOSE PRODUCT MODAL
    const closeProductBtn =
      document.getElementById(
        "closeProductModalBtn"
      );


    if (closeProductBtn) {

      closeProductBtn.addEventListener(
        "click",
        closeProductModal
      );

    }


    // CONTINUE SHOPPING
    const continueBtn =
      document.getElementById(
        "continueShoppingBtn"
      );


    if (continueBtn) {

      continueBtn.addEventListener(
        "click",
        continueShopping
      );

    }

  }
);

/* ============================================================
   MONA VARIETY STORE - CUSTOMER APP
   CLEAN FIXED VERSION
   ============================================================ */

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

let storeSettings = {};
let categories = [];
let products = [];
let paymentMethods = [];
let cart = [];
let currentCategory = "all";
let currentSearch = "";
let selectedProduct = null;

/* ============================================================
   STARTUP
   ============================================================ */

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

/* ============================================================
   HELPERS
   ============================================================ */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  const n = Number(value) || 0;
  return `৳${n.toLocaleString("en-BD")}`;
}

function getProductImage(product) {
  return product?.image_url || product?.image || "";
}

function getCategoryName(product) {
  if (!product) return "";

  const found = categories.find(
    c => String(c.id) === String(product.category_id)
  );

  return found?.name || product.category || "";
}

function normalizePhone(phone) {
  let value = String(phone || "").replace(/[^\d+]/g, "");

  if (value.startsWith("01")) {
    return "880" + value.substring(1);
  }

  if (value.startsWith("+880")) {
    return value.substring(1);
  }

  return value;
}

function getWhatsAppNumber() {
  return normalizePhone(
    storeSettings.whatsapp ||
    storeSettings.whatsapp_number ||
    storeSettings.phone ||
    ""
  );
}

function getSettingValue(...keys) {
  for (const key of keys) {
    if (
      storeSettings &&
      storeSettings[key] !== undefined &&
      storeSettings[key] !== null &&
      String(storeSettings[key]).trim() !== ""
    ) {
      return storeSettings[key];
    }
  }

  return "";
}

/* ============================================================
   STORE SETTINGS
   ============================================================ */

async function loadStoreSettings() {
  try {
    const { data, error } = await supabaseClient
      .from("store_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("Store settings error:", error.message);
      storeSettings = {};
      return;
    }

    storeSettings = data || {};
  } catch (error) {
    console.warn("Store settings exception:", error);
    storeSettings = {};
  }
}

/* ============================================================
   CATEGORIES
   ============================================================ */

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Category Error:", error);
    categories = [];
    return;
  }

  categories = data || [];
  renderCategories();
}

function renderCategories() {
  const containers = [
    document.getElementById("categoryList"),
    document.getElementById("categories"),
    document.getElementById("categoryButtons")
  ].filter(Boolean);

  if (!containers.length) return;

  const html = [
    `<button class="category-btn active"
      data-category="all"
      onclick="filterCategory('all')">
      সব পণ্য
    </button>`,

    ...categories.map(category => `
      <button
        class="category-btn"
        data-category="${escapeHTML(category.id)}"
        onclick="filterCategory('${escapeHTML(category.id)}')"
      >
        ${escapeHTML(category.name)}
      </button>
    `)
  ].join("");

  containers.forEach(container => {
    container.innerHTML = html;
  });
}

function filterCategory(categoryId) {
  currentCategory = String(categoryId || "all");

  renderCategoriesActiveState();
  renderProducts();
}

function renderCategoriesActiveState() {
  document.querySelectorAll(".category-btn").forEach(button => {
    const value = String(button.dataset.category || "");

    button.classList.toggle(
      "active",
      value === currentCategory
    );
  });
}

/* ============================================================
   PRODUCTS
   ============================================================ */

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Product Error:", error);

    products = [];

    const grid = document.getElementById("productGrid");

    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          পণ্য লোড করা যায়নি।
        </div>
      `;
    }

    return;
  }

  products = data || [];

  console.log("Products loaded:", products);
  console.log("Products found:", products.length);

  renderProducts();
}

function getFilteredProducts() {
  let result = [...products];

  /* CATEGORY FIX:
     Database uses category_id */
  if (currentCategory !== "all") {
    result = result.filter(
      product =>
        String(product.category_id || "") ===
        String(currentCategory)
    );
  }

  const search = String(currentSearch || "")
    .trim()
    .toLowerCase();

  if (search) {
    result = result.filter(product => {
      const name = String(product.name || "")
        .toLowerCase();

      const description = String(
        product.description || ""
      ).toLowerCase();

      const category = String(
        getCategoryName(product) || ""
      ).toLowerCase();

      return (
        name.includes(search) ||
        description.includes(search) ||
        category.includes(search)
      );
    });
  }

  return result;
}

function renderProducts() {
  const grid =
    document.getElementById("productGrid") ||
    document.getElementById("productsGrid") ||
    document.getElementById("products");

  if (!grid) {
    console.warn("Product grid element not found.");
    return;
  }

  const filtered = getFilteredProducts();

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div style="font-size:40px;">🛍️</div>
        <p>কোনো পণ্য পাওয়া যায়নি।</p>
      </div>
    `;

    return;
  }

  grid.innerHTML = filtered
    .map(productCard)
    .join("");
}

function productCard(product) {
  const image = getProductImage(product);
  const category = getCategoryName(product);

  const stock = Number(product.stock) || 0;
  const price = Number(product.price) || 0;
  const oldPrice = Number(product.old_price) || 0;

  const imageHTML = image
    ? `
      <img
        src="${escapeHTML(image)}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
        onerror="
          this.style.display='none';
          this.nextElementSibling.style.display='flex';
        "
      >

      <div
        class="product-image-placeholder"
        style="display:none;"
      >
        🛍️
      </div>
    `
    : `
      <div class="product-image-placeholder">
        🛍️
      </div>
    `;

  return `
    <div
      class="product-card"
      onclick="openProductModal('${escapeHTML(product.id)}')"
    >

      <div class="product-image">

        ${imageHTML}

        ${
          product.is_new
            ? `<span class="product-badge">নতুন</span>`
            : product.is_discount
              ? `<span class="product-badge">অফার</span>`
              : ""
        }

      </div>

      <div class="product-info">

        ${
          category
            ? `
              <div class="product-category">
                ${escapeHTML(category)}
              </div>
            `
            : ""
        }

        <h3 class="product-name">
          ${escapeHTML(product.name)}
        </h3>

        <div class="product-price-row">

          <span class="product-price">
            ${money(price)}
          </span>

          ${
            oldPrice > price
              ? `
                <span class="product-old-price">
                  ${money(oldPrice)}
                </span>
              `
              : ""
          }

        </div>

        <div class="product-stock">

          ${
            stock > 0
              ? `স্টক: ${stock}`
              : `
                <span style="color:#d00;">
                  স্টক শেষ
                </span>
              `
          }

        </div>

        <button
          class="add-to-cart-btn"
          onclick="
            event.stopPropagation();
            addToCart('${escapeHTML(product.id)}')
          "
          ${stock <= 0 ? "disabled" : ""}
        >
          ${
            stock > 0
              ? "কার্টে যোগ করুন"
              : "স্টক শেষ"
          }
        </button>

      </div>

    </div>
  `;
}

/* ============================================================
   PRODUCT MODAL
   ============================================================ */

function openProductModal(productId) {
  selectedProduct = products.find(
    product =>
      String(product.id) === String(productId)
  );

  if (!selectedProduct) return;

  const modal =
    document.getElementById("productModal") ||
    document.getElementById("productDetailsModal");

  if (!modal) return;

  const image = getProductImage(selectedProduct);
  const category = getCategoryName(selectedProduct);

  const price =
    Number(selectedProduct.price) || 0;

  const oldPrice =
    Number(selectedProduct.old_price) || 0;

  const imageContainer =
    modal.querySelector(".product-modal-image") ||
    modal.querySelector(".modal-product-image");

  if (imageContainer) {
    imageContainer.innerHTML = image
      ? `
        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(selectedProduct.name)}"
          onerror="this.style.display='none';"
        >
      `
      : `
        <div class="product-image-placeholder">
          🛍️
        </div>
      `;
  }

  const nameEl =
    modal.querySelector(".modal-product-name") ||
    modal.querySelector("#modalProductName");

  const priceEl =
    modal.querySelector(".modal-product-price") ||
    modal.querySelector("#modalProductPrice");

  const descEl =
    modal.querySelector(".modal-product-description") ||
    modal.querySelector("#modalProductDescription");

  const categoryEl =
    modal.querySelector(".modal-product-category") ||
    modal.querySelector("#modalProductCategory");

  if (nameEl) {
    nameEl.textContent =
      selectedProduct.name || "";
  }

  if (priceEl) {
    priceEl.innerHTML = `
      ${money(price)}

      ${
        oldPrice > price
          ? `
            <del
              style="
                opacity:.6;
                font-size:.8em;
              "
            >
              ${money(oldPrice)}
            </del>
          `
          : ""
      }
    `;
  }

  if (descEl) {
    descEl.textContent =
      selectedProduct.description || "";
  }

  if (categoryEl) {
    categoryEl.textContent = category;
  }

  modal.classList.add("show");
  modal.classList.add("active");
}

function closeProductModal() {
  const modal =
    document.getElementById("productModal") ||
    document.getElementById("productDetailsModal");

  if (!modal) return;

  modal.classList.remove(
    "show",
    "active"
  );

  selectedProduct = null;
}

/* ============================================================
   CART
   ============================================================ */

function loadCart() {
  try {
    const saved =
      localStorage.getItem("monaCart");

    cart = saved
      ? JSON.parse(saved)
      : [];

    if (!Array.isArray(cart)) {
      cart = [];
    }
  } catch (error) {
    console.warn(
      "Cart load error:",
      error
    );

    cart = [];
  }
}

function saveCart() {
  localStorage.setItem(
    "monaCart",
    JSON.stringify(cart)
  );

  updateCartUI();
}

function addToCart(
  productOrId,
  quantity = 1
) {
  const product =
    typeof productOrId === "object"
      ? productOrId
      : products.find(
          item =>
            String(item.id) ===
            String(productOrId)
        );

  if (!product) {
    alert("পণ্য পাওয়া যায়নি।");
    return;
  }

  const stock =
    Number(product.stock) || 0;

  if (stock <= 0) {
    alert(
      "এই পণ্যটি এখন স্টকে নেই।"
    );

    return;
  }

  const existing = cart.find(
    item =>
      String(item.id) ===
      String(product.id)
  );

  if (existing) {
    const nextQty =
      Number(existing.quantity || 0) +
      Number(quantity || 1);

    if (nextQty > stock) {
      alert(
        `সর্বোচ্চ ${stock} টি নেওয়া যাবে।`
      );

      existing.quantity = stock;
    } else {
      existing.quantity = nextQty;
    }
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: getProductImage(product),
      stock: stock,
      quantity: Math.min(
        Number(quantity) || 1,
        stock
      )
    });
  }

  saveCart();
  renderCart();
}

function changeQuantity(
  productId,
  delta
) {
  const item = cart.find(
    cartItem =>
      String(cartItem.id) ===
      String(productId)
  );

  if (!item) return;

  const stock =
    Number(item.stock) || 0;

  const next =
    Number(item.quantity || 0) +
    Number(delta || 0);

  if (next <= 0) {
    removeFromCart(productId);
    return;
  }

  if (stock > 0 && next > stock) {
    alert(
      `সর্বোচ্চ ${stock} টি নেওয়া যাবে।`
    );

    item.quantity = stock;
  } else {
    item.quantity = next;
  }

  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(
    item =>
      String(item.id) !==
      String(productId)
  );

  saveCart();
  renderCart();
}

function getCartSubtotal() {
  return cart.reduce(
    (sum, item) =>
      sum +
      (Number(item.price) || 0) *
      (Number(item.quantity) || 0),
    0
  );
}

function calculateDelivery() {
  const subtotal =
    getCartSubtotal();

  const freeDeliveryMinimum =
    Number(
      getSettingValue(
        "free_delivery_minimum",
        "free_delivery_amount",
        "free_shipping_minimum"
      )
    );

  if (
    freeDeliveryMinimum > 0 &&
    subtotal >= freeDeliveryMinimum
  ) {
    return 0;
  }

  const delivery =
    Number(
      getSettingValue(
        "delivery_charge",
        "delivery_fee",
        "shipping_charge",
        "delivery"
      )
    );

  return Number.isFinite(delivery)
    ? delivery
    : 0;
}

function updateCartUI() {
  const count =
    cart.reduce(
      (sum, item) =>
        sum +
        (Number(item.quantity) || 0),
      0
    );

  const subtotal =
    getCartSubtotal();

  document.querySelectorAll(
    "#cartCount, .cart-count, [data-cart-count]"
  ).forEach(el => {
    el.textContent = count;
  });

  document.querySelectorAll(
    "#cartSubtotal, .cart-subtotal, [data-cart-subtotal]"
  ).forEach(el => {
    el.textContent =
      money(subtotal);
  });
}

function renderCart() {
  const container =
    document.getElementById("cartItems") ||
    document.getElementById("cartList");

  if (!container) return;

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-cart">
        <div style="font-size:48px;">
          🛒
        </div>

        <p>
          আপনার কার্ট খালি।
        </p>
      </div>
    `;

    updateCartTotals();
    return;
  }

  container.innerHTML =
    cart.map(cartItemHTML).join("");

  updateCartTotals();
}

function cartItemHTML(item) {
  const image =
    item.image || "";

  return `
    <div class="cart-item">

      <div class="cart-item-image">

        ${
          image
            ? `
              <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(item.name)}"
                onerror="
                  this.style.display='none';
                "
              >
            `
            : `
              <div class="product-image-placeholder">
                🛍️
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

        <div class="cart-item-controls">

          <button
            onclick="
              changeQuantity(
                '${escapeHTML(item.id)}',
                -1
              )
            "
          >
            −
          </button>

          <span>
            ${Number(item.quantity) || 0}
          </span>

          <button
            onclick="
              changeQuantity(
                '${escapeHTML(item.id)}',
                1
              )
            "
          >
            +
          </button>

          <button
            class="remove-cart-item"
            onclick="
              removeFromCart(
                '${escapeHTML(item.id)}'
              )
            "
          >
            ×
          </button>

        </div>

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

  document.querySelectorAll(
    "#cartSubtotal, .cart-subtotal, [data-cart-subtotal]"
  ).forEach(el => {
    el.textContent =
      money(subtotal);
  });

  document.querySelectorAll(
    "#cartDelivery, .cart-delivery, [data-cart-delivery]"
  ).forEach(el => {
    el.textContent =
      money(delivery);
  });

  document.querySelectorAll(
    "#cartTotal, .cart-total, [data-cart-total]"
  ).forEach(el => {
    el.textContent =
      money(total);
  });
}

function openCart() {
  const modal =
    document.getElementById("cartModal") ||
    document.getElementById("cartDrawer");

  if (!modal) return;

  renderCart();

  modal.classList.add("show");
  modal.classList.add("active");
}

function closeCart() {
  const modal =
    document.getElementById("cartModal") ||
    document.getElementById("cartDrawer");

  if (!modal) return;

  modal.classList.remove(
    "show",
    "active"
  );
}

/* ============================================================
   PAYMENT METHODS
   ============================================================ */

async function loadPaymentMethods() {
  const { data, error } =
    await supabaseClient
      .from("payment_methods")
      .select("*")
      .order("created_at", {
        ascending: true
      });

  if (error) {
    console.warn(
      "Payment methods error:",
      error.message
    );

    paymentMethods = [];

    renderPaymentMethods();

    return;
  }

  paymentMethods = data || [];

  renderPaymentMethods();
}

function renderPaymentMethods() {
  const container =
    document.getElementById(
      "checkoutPaymentMethods"
    ) ||
    document.getElementById(
      "paymentMethods"
    );

  if (!container) return;

  if (!paymentMethods.length) {
    container.innerHTML = `
      <div class="payment-empty">
        পেমেন্ট মেথড পাওয়া যায়নি।
      </div>
    `;

    return;
  }

  container.innerHTML =
    paymentMethods
      .map((method, index) => {
        const id =
          method.id ?? index;

        const name =
          method.name ||
          method.title ||
          method.payment_method ||
          "Payment";

        return `
          <label class="payment-method">

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

  const value =
    selected.value;

  const method =
    paymentMethods.find(
      item =>
        String(item.id) ===
        String(value)
    );

  return (
    method?.name ||
    method?.title ||
    method?.payment_method ||
    value
  );
}/* ============================================================
   CHECKOUT
   ============================================================ */

function openCheckout() {
  if (!cart.length) {
    alert("কার্টে কোনো পণ্য নেই।");
    return;
  }

  renderCart();
  updateCheckoutTotals();

  const modal =
    document.getElementById("checkoutModal") ||
    document.getElementById("checkout");

  if (!modal) return;

  modal.classList.add("show");
  modal.classList.add("active");
}

function closeCheckout() {
  const modal =
    document.getElementById("checkoutModal") ||
    document.getElementById("checkout");

  if (!modal) return;

  modal.classList.remove(
    "show",
    "active"
  );
}

function updateCheckoutTotals() {
  const subtotal =
    getCartSubtotal();

  const delivery =
    calculateDelivery();

  const total =
    subtotal + delivery;

  document.querySelectorAll(
    "#checkoutSubtotal, .checkout-subtotal, [data-checkout-subtotal]"
  ).forEach(el => {
    el.textContent =
      money(subtotal);
  });

  document.querySelectorAll(
    "#checkoutDelivery, .checkout-delivery, [data-checkout-delivery]"
  ).forEach(el => {
    el.textContent =
      money(delivery);
  });

  document.querySelectorAll(
    "#checkoutTotal, .checkout-total, [data-checkout-total]"
  ).forEach(el => {
    el.textContent =
      money(total);
  });
}

function getCheckoutData() {
  return {
    name:
      document
        .getElementById("customerName")
        ?.value
        .trim() || "",

    phone:
      document
        .getElementById("customerPhone")
        ?.value
        .trim() || "",

    address:
      document
        .getElementById("customerAddress")
        ?.value
        .trim() || "",

    note:
      document
        .getElementById("customerNote")
        ?.value
        .trim() || "",

    payment:
      getSelectedPaymentMethod()
  };
}

/* ============================================================
   PLACE ORDER
   ============================================================ */

async function placeOrder() {
  const button =
    document.getElementById(
      "placeOrderBtn"
    );

  if (!cart.length) {
    alert(
      "কার্টে কোনো পণ্য নেই।"
    );
    return;
  }

  const data =
    getCheckoutData();

  if (!data.name) {
    alert(
      "আপনার নাম দিন।"
    );
    return;
  }

  if (!data.phone) {
    alert(
      "ফোন নম্বর দিন।"
    );
    return;
  }

  if (!data.address) {
    alert(
      "ঠিকানা দিন।"
    );
    return;
  }

  if (!data.payment) {
    alert(
      "একটি পেমেন্ট মেথড নির্বাচন করুন।"
    );
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
      price:
        Number(item.price) || 0,
      quantity:
        Number(item.quantity) || 0,
      image:
        item.image || ""
    }));

  if (button) {
    button.disabled = true;
    button.textContent =
      "অর্ডার হচ্ছে...";
  }

  try {
    const {
      data: order,
      error
    } = await supabaseClient
      .from("orders")
      .insert({
        customer_name:
          data.name,

        phone:
          data.phone,

        address:
          data.address,

        items:
          orderItems,

        subtotal:
          subtotal,

        delivery_charge:
          delivery,

        total:
          total,

        payment_method:
          data.payment || null,

        note:
          data.note || null,

        status:
          "pending"
      })
      .select()
      .single();

    if (error) {
      console.error(
        "Order Error:",
        error
      );

      alert(
        "অর্ডার করা যায়নি: " +
        error.message
      );

      if (button) {
        button.disabled = false;
        button.textContent =
          "অর্ডার কনফার্ম করুন";
      }

      return;
    }

    /* Create WhatsApp message
       BEFORE clearing cart */
    const whatsappMessage =
      createWhatsAppMessage(
        order,
        data
      );

    closeCheckout();

    /* Clear cart correctly */
    cart = [];
    saveCart();
    renderCart();

    showOrderSuccess(order);

    /* WhatsApp button */
    const whatsappButton =
      document.getElementById(
        "successWhatsappBtn"
      ) ||
      document.getElementById(
        "successWhatsAppBtn"
      );

    if (whatsappButton) {
      const whatsappNumber =
        getWhatsAppNumber();

      if (whatsappNumber) {
        whatsappButton.style.display =
          "";

        whatsappButton.onclick =
          () => {
            const url =
              "https://wa.me/" +
              whatsappNumber +
              "?text=" +
              encodeURIComponent(
                whatsappMessage
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

    if (button) {
      button.disabled = false;

      button.textContent =
        "অর্ডার কনফার্ম করুন";
    }

  } catch (error) {
    console.error(
      "Place order exception:",
      error
    );

    alert(
      "অর্ডার করার সময় সমস্যা হয়েছে: " +
      error.message
    );

    if (button) {
      button.disabled = false;

      button.textContent =
        "অর্ডার কনফার্ম করুন";
    }
  }
}

/* ============================================================
   WHATSAPP MESSAGE
   ============================================================ */

function createWhatsAppMessage(
  order,
  data
) {
  const orderId =
    order?.id || "N/A";

  const items =
    Array.isArray(order?.items)
      ? order.items
      : cart;

  let message =
    `🛍️ *Mona Variety Store - New Order*\n\n`;

  message +=
    `Order ID: ${orderId}\n`;

  message +=
    `Customer: ${data.name}\n`;

  message +=
    `Phone: ${data.phone}\n`;

  message +=
    `Address: ${data.address}\n\n`;

  message +=
    `*Products:*\n`;

  items.forEach(
    (item, index) => {
      const itemTotal =
        (Number(item.price) || 0) *
        (Number(item.quantity) || 0);

      message +=
        `${index + 1}. ${item.name} × ${item.quantity} = ${money(itemTotal)}\n`;
    }
  );

  message +=
    `\nSubtotal: ${money(
      order?.subtotal ??
      getCartSubtotal()
    )}\n`;

  message +=
    `Delivery: ${money(
      order?.delivery_charge ??
      calculateDelivery()
    )}\n`;

  message +=
    `Total: ${money(
      order?.total ??
      (
        getCartSubtotal() +
        calculateDelivery()
      )
    )}\n`;

  message +=
    `Payment: ${data.payment}\n`;

  if (data.note) {
    message +=
      `Note: ${data.note}\n`;
  }

  return message;
}

/* ============================================================
   SUCCESS MODAL
   ============================================================ */

function showOrderSuccess(
  order
) {
  const modal =
    document.getElementById(
      "successModal"
    ) ||
    document.getElementById(
      "orderSuccessModal"
    );

  const idEl =
    document.getElementById(
      "successOrderId"
    );

  if (idEl) {
    idEl.textContent =
      order?.id || "";
  }

  if (modal) {
    modal.classList.add(
      "show"
    );

    modal.classList.add(
      "active"
    );
  }
}

function closeSuccessModal() {
  const modal =
    document.getElementById(
      "successModal"
    ) ||
    document.getElementById(
      "orderSuccessModal"
    );

  if (!modal) return;

  modal.classList.remove(
    "show",
    "active"
  );
}

/* ============================================================
   SEARCH
   ============================================================ */

function handleSearch(
  value
) {
  currentSearch =
    String(value || "");

  renderProducts();
}

function clearSearch() {
  currentSearch = "";

  document.querySelectorAll(
    "#searchInput, .search-input, [data-search-input]"
  ).forEach(input => {
    input.value = "";
  });

  renderProducts();
}

/* ============================================================
   EVENTS
   ============================================================ */

function bindEvents() {

  /* Search */
  const searchInputs =
    document.querySelectorAll(
      "#searchInput, .search-input, [data-search-input]"
    );

  searchInputs.forEach(
    input => {
      input.addEventListener(
        "input",
        event => {
          handleSearch(
            event.target.value
          );
        }
      );
    }
  );

  /* Cart buttons */
  const cartButtons =
    document.querySelectorAll(
      "#cartBtn, .cart-btn, [data-open-cart]"
    );

  cartButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        openCart
      );
    }
  );

  /* Checkout buttons */
  const checkoutButtons =
    document.querySelectorAll(
      "#checkoutBtn, .checkout-btn, [data-open-checkout]"
    );

  checkoutButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        openCheckout
      );
    }
  );

  /* Close cart */
  const closeCartButtons =
    document.querySelectorAll(
      "#closeCartBtn, .close-cart, [data-close-cart]"
    );

  closeCartButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closeCart
      );
    }
  );

  /* Close checkout */
  const closeCheckoutButtons =
    document.querySelectorAll(
      "#closeCheckoutBtn, .close-checkout, [data-close-checkout]"
    );

  closeCheckoutButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closeCheckout
      );
    }
  );

  /* Close product modal */
  const closeProductButtons =
    document.querySelectorAll(
      "#closeProductModal, .close-product-modal, [data-close-product]"
    );

  closeProductButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closeProductModal
      );
    }
  );

  /* Close success modal */
  const closeSuccessButtons =
    document.querySelectorAll(
      "#closeSuccessBtn, .close-success, [data-close-success]"
    );

  closeSuccessButtons.forEach(
    button => {
      button.addEventListener(
        "click",
        closeSuccessModal
      );
    }
  );

  /* Place order */
  const placeButton =
    document.getElementById(
      "placeOrderBtn"
    );

  if (placeButton) {
    placeButton.addEventListener(
      "click",
      placeOrder
    );
  }

  /* Checkout field changes */
  const checkoutFields = [
    "customerName",
    "customerPhone",
    "customerAddress",
    "customerNote"
  ];

  checkoutFields.forEach(
    id => {
      const input =
        document.getElementById(id);

      if (input) {
        input.addEventListener(
          "input",
          updateCheckoutTotals
        );
      }
    }
  );

  /* Close modal by overlay */
  document.addEventListener(
    "click",
    event => {
      const target =
        event.target;

      if (
        target.matches(
          ".modal-overlay"
        )
      ) {
        target.classList.remove(
          "show",
          "active"
        );
      }
    }
  );
}

/* ============================================================
   RENDER ALL
   ============================================================ */

function renderAll() {
  renderCategories();
  renderCategoriesActiveState();
  renderProducts();
  renderCart();
  updateCheckoutTotals();
  updateCartUI();

  const shopName =
    getSettingValue(
      "store_name",
      "shop_name",
      "name",
      "business_name"
    );

  if (shopName) {
    document
      .querySelectorAll(
        ".store-name, #storeName, [data-store-name]"
      )
      .forEach(el => {
        el.textContent =
          shopName;
      });
  }

  const logo =
    getSettingValue(
      "logo_url",
      "logo",
      "store_logo"
    );

  if (logo) {
    document
      .querySelectorAll(
        ".store-logo, #storeLogo, [data-store-logo]"
      )
      .forEach(el => {
        if (
          el.tagName === "IMG"
        ) {
          el.src = logo;
        }
      });
  }
}

/* ============================================================
   COMPATIBILITY FUNCTIONS
   ============================================================ */

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

/* ============================================================
   GLOBAL FUNCTIONS
   ============================================================ */

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

// ============================================================
// MONA VARIETY STORE - PREMIUM ADMIN.JS
// PART 1/3
// ============================================================

const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

let supabaseClient = null;
let currentUser = null;

let categories = [];
let products = [];
let payments = [];

let editingProductId = null;

let allOrders = [];
let expandedOrders = new Set();
let lastOrderIds = new Set();
let firstOrderLoad = true;

let orderPollTimer = null;
let realtimeChannel = null;


// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    try {

        initializeSupabase();

        injectPremiumAdminStyles();

        bindEvents();

        await checkSession();

    } catch (error) {

        console.error("ADMIN INIT ERROR:", error);

        showGlobalError(
            error?.message || "Admin system initialization failed."
        );

    }

});


// ============================================================
// SUPABASE INIT
// ============================================================

function initializeSupabase() {

    if (!window.supabase) {
        throw new Error(
            "Supabase library not loaded."
        );
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error(
            "Supabase configuration missing. Check config.js"
        );
    }

    supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );

    console.log(
        "✅ Supabase initialized"
    );
}


// ============================================================
// HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}


function getValue(id) {

    const el = $(id);

    return el ? el.value.trim() : "";
}


function setValue(id, value) {

    const el = $(id);

    if (el) {
        el.value = value ?? "";
    }
}


function setChecked(id, value) {

    const el = $(id);

    if (el) {
        el.checked = !!value;
    }
}


function numberOrZero(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : 0;
}


function numberOrNull(value) {

    if (
        value === "" ||
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const n = Number(value);

    return Number.isFinite(n) ? n : null;
}


function money(value) {

    return "৳" +
        numberOrZero(value)
            .toLocaleString("en-BD", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            });
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function showMessage(
    elementId,
    message,
    type = "success"
) {

    const el = $(elementId);

    if (!el) return;

    el.textContent = message;

    el.className =
        "admin-message " + type;

    el.style.display = "block";

    clearTimeout(
        el._messageTimer
    );

    el._messageTimer =
        setTimeout(() => {

            el.style.display = "none";

        }, 4500);
}


function showGlobalError(message) {

    console.error(message);

    alert(
        "Admin Error:\n\n" +
        message
    );
}


function setButtonLoading(
    button,
    loading,
    loadingText = "Saving..."
) {

    if (!button) return;

    if (loading) {

        button.dataset.originalText =
            button.innerHTML;

        button.disabled = true;

        button.innerHTML =
            `<span class="admin-spinner"></span> ${loadingText}`;

    } else {

        button.disabled = false;

        button.innerHTML =
            button.dataset.originalText ||
            "Save";

    }
}


// ============================================================
// AUTH SESSION
// ============================================================

async function checkSession() {

    if (!supabaseClient) return;

    const {
        data,
        error
    } =
        await supabaseClient.auth.getSession();

    if (error) {

        console.error(
            "SESSION ERROR:",
            error
        );

        showLogin();

        return;
    }

    currentUser =
        data?.session?.user || null;

    if (!currentUser) {

        showLogin();

        return;
    }

    console.log(
        "Logged in user:",
        currentUser.id
    );

    const isAdmin =
        await checkAdmin();

    if (!isAdmin) {

        showLogin();

        return;
    }

    showAdminPanel();

    await loadAllAdminData();

    startOrderPolling();

    setupOptionalRealtime();
}


// ============================================================
// ADMIN VERIFICATION
// ============================================================

async function checkAdmin() {

    if (!currentUser) {
        return false;
    }

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("admins")
            .select("user_id")
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();

        // IMPORTANT:
        // Do NOT throw immediately.
        // This shows the actual Supabase error.

        if (error) {

            console.error(
                "ADMIN QUERY ERROR:",
                error
            );

            const fullError =
                JSON.stringify(
                    {
                        message: error.message,
                        code: error.code,
                        details: error.details,
                        hint: error.hint
                    },
                    null,
                    2
                );

            console.error(
                "ADMIN QUERY FULL ERROR:",
                fullError
            );

            showMessage(
                "loginMessage",
                "Admin verification failed: " +
                (
                    error.message ||
                    "Database error"
                ),
                "error"
            );

            return false;
        }

        if (!data) {

            console.warn(
                "Unauthorized admin:",
                currentUser.id
            );

            showMessage(
                "loginMessage",
                "এই account টি Admin হিসেবে অনুমোদিত নয়।",
                "error"
            );

            await supabaseClient.auth.signOut();

            currentUser = null;

            return false;
        }

        console.log(
            "✅ ADMIN VERIFIED:",
            data
        );

        return true;

    } catch (error) {

        console.error(
            "ADMIN VERIFICATION EXCEPTION:",
            error
        );

        showMessage(
            "loginMessage",
            "Admin verification failed: " +
            (
                error?.message ||
                "Unknown error"
            ),
            "error"
        );

        return false;
    }
}


// ============================================================
// LOGIN
// ============================================================

async function login() {

    const email =
        getValue("loginEmail");

    const password =
        getValue("loginPassword");

    if (!email || !password) {

        showMessage(
            "loginMessage",
            "Email এবং Password দিন।",
            "error"
        );

        return;
    }

    const button =
        $("loginBtn");

    setButtonLoading(
        button,
        true,
        "Logging in..."
    );

    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth
                .signInWithPassword({
                    email,
                    password
                });

        if (error) {
            throw error;
        }

        currentUser =
            data?.user || null;

        if (!currentUser) {

            throw new Error(
                "Login user পাওয়া যায়নি।"
            );
        }

        console.log(
            "LOGIN SUCCESS:",
            currentUser.id
        );

        const isAdmin =
            await checkAdmin();

        if (!isAdmin) {
            return;
        }

        showAdminPanel();

        await loadAllAdminData();

        startOrderPolling();

        setupOptionalRealtime();

    } catch (error) {

        console.error(
            "LOGIN ERROR:",
            error
        );

        showMessage(
            "loginMessage",
            getAuthErrorMessage(error),
            "error"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


// ============================================================
// AUTH ERROR MESSAGE
// ============================================================

function getAuthErrorMessage(error) {

    const message =
        String(
            error?.message || ""
        ).toLowerCase();

    if (
        message.includes("invalid login credentials")
    ) {
        return "Email অথবা Password ভুল।";
    }

    if (
        message.includes("email not confirmed")
    ) {
        return "এই Email এখনো confirm করা হয়নি।";
    }

    if (
        message.includes("too many requests")
    ) {
        return "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    }

    return (
        error?.message ||
        "Login failed."
    );
}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    try {

        stopOrderPolling();

        if (
            realtimeChannel &&
            supabaseClient
        ) {

            await supabaseClient
                .removeChannel(
                    realtimeChannel
                );

            realtimeChannel = null;
        }

        await supabaseClient.auth.signOut();

        currentUser = null;

        showLogin();

    } catch (error) {

        console.error(
            "LOGOUT ERROR:",
            error
        );

    }
}


// ============================================================
// LOGIN / PANEL UI
// ============================================================

function showLogin() {

    const login =
        $("loginSection");

    const panel =
        $("adminPanel");

    if (login) {
        login.style.display = "flex";
    }

    if (panel) {
        panel.style.display = "none";
    }
}


function showAdminPanel() {

    const login =
        $("loginSection");

    const panel =
        $("adminPanel");

    if (login) {
        login.style.display = "none";
    }

    if (panel) {
        panel.style.display = "block";
    }
}


// ============================================================
// LOAD ALL DATA
// ============================================================

async function loadAllAdminData() {

    console.log(
        "Loading admin data..."
    );

    await loadStoreSettings();

    await loadCategories();

    await loadProducts();

    await loadPaymentMethods();

    await loadOrders(false);

    console.log(
        "✅ Admin data loaded"
    );
}


// ============================================================
// STORE SETTINGS
// ============================================================

async function loadStoreSettings() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("store_settings")
            .select("*")
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            console.warn(
                "No store settings found."
            );
            return;
        }

        setValue(
            "storeName",
            data.store_name
        );

        setValue(
            "tagline",
            data.tagline
        );

        setValue(
            "phone",
            data.phone
        );

        setValue(
            "whatsapp",
            data.whatsapp
        );

        setValue(
            "facebookUrl",
            data.facebook_url
        );

        setValue(
            "tiktokUrl",
            data.tiktok_url
        );

        setValue(
            "logoUrl",
            data.logo_url
        );

        setValue(
            "foundingYear",
            data.founding_year
        );

        setValue(
            "proprietorName",
            data.proprietor_name
        );

        setValue(
            "managementNames",
            data.management_names
        );

        setValue(
            "address",
            data.address
        );

        setValue(
            "mapUrl",
            data.map_url
        );

        setValue(
            "openingHours",
            data.opening_hours
        );

        setValue(
            "aboutText",
            data.about_text
        );

        setValue(
            "deliveryCharge",
            data.delivery_charge
        );

        setValue(
            "freeDeliveryMin",
            data.free_delivery_min
        );

    } catch (error) {

        console.error(
            "STORE LOAD ERROR:",
            error
        );

        showMessage(
            "storeMessage",
            "Store settings load failed: " +
            error.message,
            "error"
        );
    }
}


// ============================================================
// SAVE STORE SETTINGS
// ============================================================

async function saveStoreSettings() {

    const button =
        $("saveStoreBtn");

    setButtonLoading(
        button,
        true,
        "Saving..."
    );

    try {

        const payload = {

            store_name:
                getValue("storeName"),

            tagline:
                getValue("tagline"),

            phone:
                getValue("phone"),

            whatsapp:
                getValue("whatsapp"),

            facebook_url:
                getValue("facebookUrl"),

            tiktok_url:
                getValue("tiktokUrl"),

            logo_url:
                getValue("logoUrl"),

            founding_year:
                getValue("foundingYear"),

            proprietor_name:
                getValue("proprietorName"),

            management_names:
                getValue("managementNames"),

            address:
                getValue("address"),

            map_url:
                getValue("mapUrl"),

            opening_hours:
                getValue("openingHours"),

            about_text:
                getValue("aboutText"),

            delivery_charge:
                numberOrZero(
                    getValue("deliveryCharge")
                ),

            free_delivery_min:
                numberOrZero(
                    getValue("freeDeliveryMin")
                )
        };

        const {
            data: existing,
            error: findError
        } =
            await supabaseClient
                .from("store_settings")
                .select("id")
                .limit(1)
                .maybeSingle();

        if (findError) {
            throw findError;
        }

        let result;

        if (existing?.id) {

            result =
                await supabaseClient
                    .from("store_settings")
                    .update(payload)
                    .eq(
                        "id",
                        existing.id
                    );

        } else {

            result =
                await supabaseClient
                    .from("store_settings")
                    .insert(payload);
        }

        if (result.error) {
            throw result.error;
        }

        showMessage(
            "storeMessage",
            "✅ Store settings saved successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "STORE SAVE ERROR:",
            error
        );

        showMessage(
            "storeMessage",
            "Save failed: " +
            error.message,
            "error"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


// ============================================================
// CATEGORIES - LOAD
// ============================================================

async function loadCategories() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("categories")
            .select("*")
            .order("name", {
                ascending: true
            });

    if (error) {

        console.error(
            "CATEGORY LOAD ERROR:",
            error
        );

        return;
    }

    categories =
        data || [];

    renderCategoryList();

    populateProductCategoryOptions();

    populateProductFilterCategories();
}


// ============================================================
// CATEGORY OPTIONS
// ============================================================

function populateProductCategoryOptions() {

    const select =
        $("productCategory");

    if (!select) return;

    const current =
        select.value;

    select.innerHTML =
        `<option value="">-- Category select --</option>`;

    categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value =
            category.id;

        option.textContent =
            (
                category.icon
                    ? category.icon + " "
                    : ""
            ) +
            category.name;

        select.appendChild(option);

    });

    select.value = current;
}


function populateProductFilterCategories() {

    const select =
        $("productFilterCategory");

    if (!select) return;

    const current =
        select.value;

    select.innerHTML =
        `<option value="">All Categories</option>`;

    categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value =
            category.id;

        option.textContent =
            category.name;

        select.appendChild(option);

    });

    select.value = current;
}


// ============================================================
// CATEGORY LIST
// ============================================================

function renderCategoryList() {

    const container = $("categoryList");

    if (!container) return;

    if (!categories || !categories.length) {
        container.innerHTML = `
            <div class="admin-empty">
                No categories found.
            </div>
        `;
        return;
    }

    container.innerHTML = categories
        .map(category => {

            return `
                <div class="category-card">

                    <div class="category-icon">
                        ${escapeHtml(category.icon || "🛍️")}
                    </div>

                    <div class="category-info">
                        <h3>
                            ${escapeHtml(category.name || "")}
                        </h3>
                    </div>

                    <button
                        type="button"
                        class="delete-category-btn"
                        data-category-id="${category.id}"
                        title="Delete Category"
                    >
                        🗑️ Delete
                    </button>

                </div>
            `;

        })
        .join("");

    container
        .querySelectorAll(".delete-category-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                async function () {

                    const categoryId =
                        this.dataset.categoryId;

                    const category =
                        categories.find(
                            item =>
                                String(item.id) ===
                                String(categoryId)
                        );

                    if (!category) return;

                    const confirmed =
                        confirm(
                            `Delete "${category.name}" category?`
                        );

                    if (!confirmed) return;

                    try {

                        setButtonLoading(
                            this,
                            true,
                            "Deleting..."
                        );

                        const {
                            error
                        } = await supabaseClient
                            .from("categories")
                            .delete()
                            .eq("id", categoryId);

                        if (error) {
                            throw error;
                        }

                        categories =
                            categories.filter(
                                item =>
                                    String(item.id) !==
                                    String(categoryId)
                            );

                        renderCategoryList();

                        populateProductCategoryOptions();

                        populateProductFilterCategories();

                        showMessage(
                            "categoryMessage",
                            "Category deleted successfully.",
                            "success"
                        );

                    } catch (error) {

                        console.error(
                            "CATEGORY DELETE ERROR:",
                            error
                        );

                        showMessage(
                            "categoryMessage",
                            "Category delete failed: " +
                            (
                                error.message ||
                                "Unknown error"
                            ),
                            "error"
                        );

                        setButtonLoading(
                            this,
                            false
                        );
                    }
                }
            );
        });
}


// ============================================================
// ADD CATEGORY
// ============================================================

async function saveCategory() {

    const name =
        getValue("categoryName");

    const icon =
        getValue("categoryIcon") ||
        "📦";

    if (!name) {

        showMessage(
            "categoryMessage",
            "Category name দিন।",
            "error"
        );

        return;
    }

    const button =
        $("saveCategoryBtn");

    setButtonLoading(
        button,
        true,
        "Saving..."
    );

    try {

        const {
            error
        } =
            await supabaseClient
                .from("categories")
                .insert({
                    name,
                    icon
                });

        if (error) {
            throw error;
        }

        setValue(
            "categoryName",
            ""
        );

        setValue(
            "categoryIcon",
            ""
        );

        await loadCategories();

        showMessage(
            "categoryMessage",
            "✅ Category added.",
            "success"
        );

    } catch (error) {

        console.error(
            "CATEGORY SAVE ERROR:",
            error
        );

        showMessage(
            "categoryMessage",
            error.message,
            "error"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


// ============================================================
// DELETE CATEGORY
// ============================================================

async function deleteCategory(id) {

    if (
        !confirm(
            "এই category delete করবেন?"
        )
    ) {
        return;
    }

    try {

        const {
            error
        } =
            await supabaseClient
                .from("categories")
                .delete()
                .eq("id", id);

        if (error) {
            throw error;
        }

        await loadCategories();

        await loadProducts();

        showMessage(
            "categoryMessage",
            "Category deleted.",
            "success"
        );

    } catch (error) {

        console.error(
            "CATEGORY DELETE ERROR:",
            error
        );

        showMessage(
            "categoryMessage",
            error.message,
            "error"
        );
    }
}


// ============================================================
// PRODUCTS - LOAD
// ============================================================

async function loadProducts() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("products")
            .select("*")
            .order("created_at", {
                ascending: false
            });

    if (error) {

        console.error(
            "PRODUCT LOAD ERROR:",
            error
        );

        return;
    }

    products =
        data || [];

    renderProductList();

    renderCategoryList();
}


// ============================================================
// PRODUCT LIST
// ============================================================

function renderProductList() {

    const container =
        $("productList");

    if (!container) return;

    let list =
        [...products];

    const search =
        getValue("productSearch")
            .toLowerCase();

    const category =
        getValue("productFilterCategory");

    if (search) {

        list =
            list.filter(product =>

                String(
                    product.name || ""
                )
                    .toLowerCase()
                    .includes(search)

            );
    }

    if (category) {

        list =
            list.filter(
                product =>
                    product.category_id ===
                    category
            );
    }

    if (!list.length) {

        container.innerHTML =
            `<div class="admin-empty">
                No products found.
            </div>`;

        return;
    }

    container.innerHTML =
        list
            .map(product => {

                const categoryName =
                    categories.find(
                        c =>
                            c.id ===
                            product.category_id
                    )?.name ||
                    "Uncategorized";

                return `
                <div class="product-row">

                    <div class="product-image-wrap">

                        ${
                            product.image
                                ? `
                                <img
                                    src="${escapeHtml(
                                        product.image
                                    )}"
                                    alt="${escapeHtml(
                                        product.name
                                    )}"
                                    class="product-admin-image"
                                >
                                `
                                :
                                `
                                <div class="product-placeholder">
                                    📦
                                </div>
                                `
                        }

                    </div>

                    <div class="product-main">

                        <h3>
                            ${escapeHtml(
                                product.name
                            )}
                        </h3>

                        <div class="product-meta">
                            ${escapeHtml(
                                categoryName
                            )}
                        </div>

                        <div class="product-price">
                            ${money(
                                product.price
                            )}

                            ${
                                product.old_price
                                    ? `
                                    <del>
                                        ${money(
                                            product.old_price
                                        )}
                                    </del>
                                    `
                                    : ""
                            }
                        </div>

                        <div class="product-badges">

                            ${
                                product.active
                                    ? `<span class="badge active">Active</span>`
                                    : `<span class="badge inactive">Inactive</span>`
                            }

                            ${
                                product.featured
                                    ? `<span class="badge">Featured</span>`
                                    : ""
                            }

                            ${
                                product.is_new
                                    ? `<span class="badge">New</span>`
                                    : ""
                            }

                            ${
                                product.best_seller
                                    ? `<span class="badge">Best Seller</span>`
                                    : ""
                            }

                            ${
                                product.discount
                                    ? `
                                    <span class="badge">
                                        ${escapeHtml(
                                            product.discount
                                        )}
                                    </span>
                                    `
                                    : ""
                            }

                        </div>

                    </div>

                    <div class="product-stock">
                        Stock:
                        <strong>
                            ${numberOrZero(
                                product.stock
                            )}
                        </strong>
                    </div>

                    <div class="product-actions">

                        <button
                            class="edit-btn"
                            data-edit-product="${product.id}"
                        >
                            Edit
                        </button>

                        <button
                            class="danger-btn"
                            data-delete-product="${product.id}"
                        >
                            Delete
                        </button>

                    </div>

                </div>
                `;

            })
            .join("");
}


// ============================================================
// EDIT PRODUCT
// ============================================================

function editProduct(id) {

    const product =
        products.find(
            p => p.id === id
        );

    if (!product) return;

    editingProductId =
        id;

    setValue(
        "productName",
        product.name
    );

    setValue(
        "productCategory",
        product.category_id
    );

    setValue(
        "productPrice",
        product.price
    );

    setValue(
        "productOldPrice",
        product.old_price
    );

    setValue(
        "productStock",
        product.stock
    );

    setValue(
        "productImage",
        product.image
    );

    setValue(
        "productDescription",
        product.description
    );

    setChecked(
        "productActive",
        product.active
    );

    setChecked(
        "productFeatured",
        product.featured
    );

    setChecked(
        "productNew",
        product.is_new
    );

    setChecked(
        "productBestSeller",
        product.best_seller
    );

    setValue(
        "productDiscount",
        product.discount
    );

    const cancel =
        $("cancelProductBtn");

    if (cancel) {
        cancel.style.display =
            "inline-flex";
    }

    const save =
        $("saveProductBtn");

    if (save) {
        save.textContent =
            "Update Product";
    }

    $("productName")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
}


// ============================================================
// RESET PRODUCT FORM
// ============================================================

function resetProductForm() {

    editingProductId =
        null;

    [
        "productName",
        "productPrice",
        "productOldPrice",
        "productStock",
        "productImage",
        "productDescription",
        "productDiscount"
    ].forEach(id => {

        setValue(
            id,
            ""
        );

    });

    setValue(
        "productCategory",
        ""
    );

    setChecked(
        "productActive",
        true
    );

    setChecked(
        "productFeatured",
        false
    );

    setChecked(
        "productNew",
        false
    );

    setChecked(
        "productBestSeller",
        false
    );

    const cancel =
        $("cancelProductBtn");

    if (cancel) {
        cancel.style.display =
            "none";
    }

    const save =
        $("saveProductBtn");

    if (save) {
        save.textContent =
            "Save Product";
    }
}


// ============================================================
// SAVE PRODUCT
// ============================================================

async function saveProduct() {

    const name =
        getValue("productName");

    const categoryId =
        getValue("productCategory");

    const price =
        numberOrZero(
            getValue("productPrice")
        );

    if (!name) {

        showMessage(
            "productMessage",
            "Product name দিন।",
            "error"
        );

        return;
    }

    if (price <= 0) {

        showMessage(
            "productMessage",
            "Valid price দিন।",
            "error"
        );

        return;
    }

    const payload = {

        name,

        category_id:
            categoryId || null,

        price,

        old_price:
            numberOrNull(
                getValue("productOldPrice")
            ),

        stock:
            numberOrZero(
                getValue("productStock")
            ),

        image:
            getValue("productImage"),

        description:
            getValue("productDescription"),

        active:
            $("productActive")
                ? $("productActive").checked
                : true,

        featured:
            $("productFeatured")
                ? $("productFeatured").checked
                : false,

        is_new:
            $("productNew")
                ? $("productNew").checked
                : false,

        best_seller:
            $("productBestSeller")
                ? $("productBestSeller").checked
                : false,

        discount:
            getValue("productDiscount")
    };

    const button =
        $("saveProductBtn");

    setButtonLoading(
        button,
        true,
        editingProductId
            ? "Updating..."
            : "Saving..."
    );

    try {

        let result;

        if (editingProductId) {

            result =
                await supabaseClient
                    .from("products")
                    .update(payload)
                    .eq(
                        "id",
                        editingProductId
                    );

        } else {

            result =
                await supabaseClient
                    .from("products")
                    .insert(payload);
        }

        if (result.error) {
            throw result.error;
        }

        showMessage(
            "productMessage",
            editingProductId
                ? "✅ Product updated."
                : "✅ Product added.",
            "success"
        );

        resetProductForm();

        await loadProducts();

    } catch (error) {

        console.error(
            "PRODUCT SAVE ERROR:",
            error
        );

        showMessage(
            "productMessage",
            error.message,
            "error"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


// ============================================================
// DELETE PRODUCT
// ============================================================

async function deleteProduct(id) {

    if (
        !confirm(
            "এই product delete করবেন?"
        )
    ) {
        return;
    }

    try {

        const {
            error
        } =
            await supabaseClient
                .from("products")
                .delete()
                .eq("id", id);

        if (error) {
            throw error;
        }

        await loadProducts();

        showMessage(
            "productMessage",
            "Product deleted.",
            "success"
        );

    } catch (error) {

        console.error(
            "PRODUCT DELETE ERROR:",
            error
        );

        showMessage(
            "productMessage",
            error.message,
            "error"
        );
    }
}


// ============================================================
// END PART 1
// ============================================================
// PART 2 এর কোড এর ঠিক নিচে paste করবে.
// ============================================================// ============================================================
// MONA VARIETY STORE - PREMIUM ADMIN.JS
// PART 2/3
// ============================================================


// ============================================================
// PAYMENT METHODS
// ============================================================

async function loadPaymentMethods() {

    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("payment_methods")
            .select("*")
            .order("id", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        payments = data || [];

        renderPaymentMethods();

    } catch (error) {

        console.error(
            "PAYMENT LOAD ERROR:",
            error
        );

        showMessage(
            "paymentMessage",
            "Payment methods load failed: " +
            error.message,
            "error"
        );
    }
}


// ============================================================
// RENDER PAYMENTS
// ============================================================

function renderPaymentMethods() {

    const container =
        $("paymentList");

    if (!container) return;

    if (!payments.length) {

        container.innerHTML = `
            <div class="admin-empty">
                No payment methods found.
            </div>
        `;

        return;
    }

    container.innerHTML =
        payments.map(payment => {

            return `
                <div
                    class="payment-row"
                    data-payment-id="${payment.id}"
                >

                    <div class="payment-info">

                        <input
                            type="text"
                            class="payment-name"
                            value="${escapeHtml(
                                payment.name || ""
                            )}"
                            placeholder="Payment name"
                        >

                        <input
                            type="text"
                            class="payment-number"
                            value="${escapeHtml(
                                payment.number || ""
                            )}"
                            placeholder="Number"
                        >

                        <textarea
                            class="payment-instructions"
                            placeholder="Instructions"
                        >${escapeHtml(
                            payment.instructions || ""
                        )}</textarea>

                    </div>

                    <label class="payment-toggle">

                        <input
                            type="checkbox"
                            class="payment-active"
                            ${
                                payment.active !== false
                                    ? "checked"
                                    : ""
                            }
                        >

                        <span>
                            Active
                        </span>

                    </label>

                </div>
            `;

        }).join("");
}


// ============================================================
// SAVE PAYMENTS
// ============================================================

async function savePayments() {

    const button =
        $("savePaymentsBtn");

    setButtonLoading(
        button,
        true,
        "Saving..."
    );

    try {

        const rows =
            document.querySelectorAll(
                ".payment-row"
            );

        for (const row of rows) {

            const id =
                row.dataset.paymentId;

            if (!id) continue;

            const name =
                row.querySelector(
                    ".payment-name"
                )?.value.trim() || "";

            const number =
                row.querySelector(
                    ".payment-number"
                )?.value.trim() || "";

            const instructions =
                row.querySelector(
                    ".payment-instructions"
                )?.value.trim() || "";

            const active =
                row.querySelector(
                    ".payment-active"
                )?.checked ?? true;

            const {
                error
            } =
                await supabaseClient
                    .from("payment_methods")
                    .update({
                        name,
                        number,
                        instructions,
                        active
                    })
                    .eq(
                        "id",
                        id
                    );

            if (error) {
                throw error;
            }
        }

        await loadPaymentMethods();

        showMessage(
            "paymentMessage",
            "✅ Payment methods saved.",
            "success"
        );

    } catch (error) {

        console.error(
            "PAYMENT SAVE ERROR:",
            error
        );

        showMessage(
            "paymentMessage",
            "Payment save failed: " +
            error.message,
            "error"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );
    }
}


// ============================================================
// ORDERS
// ============================================================

async function loadOrders(
    notify = false
) {

    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("orders")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (error) {
            throw error;
        }

        const newOrders =
            data || [];

        const newPendingOrders =
            newOrders.filter(order => {

                const id =
                    order.id;

                const status =
                    normalizeOrderStatus(
                        order.status
                    );

                return (
                    status === "pending" &&
                    !lastOrderIds.has(id)
                );

            });

        allOrders =
            newOrders;

        lastOrderIds =
            new Set(
                newOrders.map(
                    order => order.id
                )
            );

        renderOrderDashboard();

        renderOrders();

        if (
            notify &&
            !firstOrderLoad &&
            newPendingOrders.length
        ) {

            notifyNewOrders(
                newPendingOrders
            );
        }

        firstOrderLoad = false;

    } catch (error) {

        console.error(
            "ORDER LOAD ERROR:",
            error
        );

        showMessage(
            "ordersMessage",
            "Orders load failed: " +
            error.message,
            "error"
        );
    }
}


// ============================================================
// ORDER STATUS
// ============================================================

function normalizeOrderStatus(
    status
) {

    return String(
        status || "pending"
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
}


function orderStatusLabel(
    status
) {

    const map = {

        pending:
            "Pending",

        confirmed:
            "Confirmed",

        processing:
            "Processing",

        shipped:
            "Shipped",

        delivered:
            "Delivered",

        cancelled:
            "Cancelled"

    };

    return (
        map[
            normalizeOrderStatus(status)
        ] ||
        "Pending"
    );
}


// ============================================================
// ORDER NUMBER
// ============================================================

function getOrderNumber(
    order
) {

    if (
        order?.order_number
    ) {
        return order.order_number;
    }

    const id =
        String(
            order?.id || ""
        )
            .replace(
                /-/g,
                ""
            )
            .substring(
                0,
                8
            )
            .toUpperCase();

    return (
        "MVS-" +
        (
            id ||
            "ORDER"
        )
    );
}


// ============================================================
// ORDER DATE
// ============================================================

function formatOrderDate(
    value
) {

    if (!value) {
        return "";
    }

    try {

        return new Date(
            value
        ).toLocaleString(
            "bn-BD",
            {
                dateStyle:
                    "medium",
                timeStyle:
                    "short"
            }
        );

    } catch {

        return String(value);
    }
}


// ============================================================
// DASHBOARD STATS
// ============================================================

function renderOrderDashboard() {

    const section =
        $("orderSection");

    if (!section) return;

    let dashboard =
        $("orderDashboard");

    if (!dashboard) {

        dashboard =
            document.createElement(
                "div"
            );

        dashboard.id =
            "orderDashboard";

        const searchRow =
            section.querySelector(
                ".search-row"
            );

        if (searchRow) {

            section.insertBefore(
                dashboard,
                searchRow
            );

        } else {

            section.prepend(
                dashboard
            );
        }
    }

    const count = status =>

        allOrders.filter(
            order =>
                normalizeOrderStatus(
                    order.status
                ) === status
        ).length;

    dashboard.innerHTML = `

        <div class="order-stat-card total">

            <span class="stat-icon">
                📦
            </span>

            <div>
                <small>
                    Total Orders
                </small>

                <strong>
                    ${allOrders.length}
                </strong>
            </div>

        </div>


        <div
            class="order-stat-card pending"
            data-order-stat="pending"
        >

            <span class="stat-icon">
                🔔
            </span>

            <div>
                <small>
                    Pending
                </small>

                <strong>
                    ${count("pending")}
                </strong>
            </div>

        </div>


        <div class="order-stat-card">

            <span class="stat-icon">
                ✅
            </span>

            <div>
                <small>
                    Confirmed
                </small>

                <strong>
                    ${count("confirmed")}
                </strong>
            </div>

        </div>


        <div class="order-stat-card">

            <span class="stat-icon">
                🚚
            </span>

            <div>
                <small>
                    Shipped
                </small>

                <strong>
                    ${count("shipped")}
                </strong>
            </div>

        </div>


        <div class="order-stat-card">

            <span class="stat-icon">
                🎉
            </span>

            <div>
                <small>
                    Delivered
                </small>

                <strong>
                    ${count("delivered")}
                </strong>
            </div>

        </div>

        <button
            type="button"
            id="enableNotificationsBtn"
            class="notification-btn"
        >
            🔔 Enable Notifications
        </button>

    `;
}


// ============================================================
// RENDER ORDERS
// ============================================================

function renderOrders() {

    const container =
        $("ordersList");

    if (!container) return;

    const search =
        getValue("orderSearch")
            .toLowerCase();

    const statusFilter =
        getValue("orderStatusFilter");

    let orders =
        [...allOrders];

    if (search) {

        orders =
            orders.filter(order => {

                const text =
                    [
                        order.customer_name,
                        order.phone,
                        order.address,
                        order.order_number,
                        order.id,
                        order.payment_method
                    ]
                        .join(" ")
                        .toLowerCase();

                return text.includes(
                    search
                );
            });
    }

    if (statusFilter) {

        orders =
            orders.filter(order =>

                normalizeOrderStatus(
                    order.status
                ) ===
                normalizeOrderStatus(
                    statusFilter
                )

            );
    }

    if (!orders.length) {

        container.innerHTML = `
            <div class="admin-empty">
                <div class="empty-icon">
                    📦
                </div>

                <strong>
                    No orders found
                </strong>

                <span>
                    নতুন order এলে এখানে দেখা যাবে।
                </span>
            </div>
        `;

        return;
    }

    container.innerHTML =
        orders.map(
            order =>
                renderSingleOrder(
                    order
                )
        ).join("");
}


// ============================================================
// SINGLE ORDER CARD
// ============================================================

function renderSingleOrder(
    order
) {

    const orderId =
        order.id;

    const expanded =
        expandedOrders.has(
            orderId
        );

    const status =
        normalizeOrderStatus(
            order.status
        );

    const statusText =
        orderStatusLabel(
            status
        );

    const items =
        Array.isArray(
            order.items
        )
            ? order.items
            : [];

    const itemCount =
        items.reduce(
            (
                total,
                item
            ) =>
                total +
                numberOrZero(
                    item.quantity ||
                    item.qty ||
                    1
                ),
            0
        );

    return `

        <article
            class="order-card
            ${status}
            ${
                expanded
                    ? "expanded"
                    : ""
            }"
            data-order-id="${escapeHtml(
                orderId
            )}"
        >

            <div class="order-card-head">

                <div class="order-title-area">

                    <div class="order-number">
                        ${escapeHtml(
                            getOrderNumber(
                                order
                            )
                        )}
                    </div>

                    <div class="order-date">
                        ${escapeHtml(
                            formatOrderDate(
                                order.created_at
                            )
                        )}
                    </div>

                </div>


                <span
                    class="order-status status-${escapeHtml(
                        status
                    )}"
                >
                    ${escapeHtml(
                        statusText
                    )}
                </span>

            </div>


            <div class="order-customer">

                <div class="customer-avatar">
                    ${escapeHtml(
                        String(
                            order.customer_name ||
                            "C"
                        )
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <div class="customer-info">

                    <strong>
                        ${escapeHtml(
                            order.customer_name ||
                            "Customer"
                        )}
                    </strong>

                    <a
                        href="tel:${escapeHtml(
                            order.phone || ""
                        )}"
                    >
                        📞
                        ${escapeHtml(
                            order.phone || ""
                        )}
                    </a>

                    ${
                        order.address
                            ? `
                            <span>
                                📍
                                ${escapeHtml(
                                    order.address
                                )}
                            </span>
                            `
                            : ""
                    }

                </div>

            </div>


            <div class="order-summary-line">

                <span>
                    🛍️
                    ${itemCount}
                    item${itemCount === 1 ? "" : "s"}
                </span>

                <strong>
                    ${money(
                        order.total
                    )}
                </strong>

            </div>


            ${
                expanded
                    ? renderOrderDetails(
                        order
                    )
                    : ""
            }


            <div class="order-actions">

                <button
                    type="button"
                    class="secondary-btn"
                    data-toggle-order="${escapeHtml(
                        orderId
                    )}"
                >
                    ${
                        expanded
                            ? "▲ Hide"
                            : "▼ Details"
                    }
                </button>


                <button
                    type="button"
                    class="secondary-btn"
                    data-call-order="${escapeHtml(
                        orderId
                    )}"
                >
                    📞 Call
                </button>


                <button
                    type="button"
                    class="whatsapp-order-btn"
                    data-whatsapp-order="${escapeHtml(
                        orderId
                    )}"
                >
                    💬 WhatsApp
                </button>


                <button
                    type="button"
                    class="secondary-btn"
                    data-print-order="${escapeHtml(
                        orderId
                    )}"
                >
                    🖨️ Print
                </button>

            </div>

        </article>

    `;
}


// ============================================================
// ORDER DETAILS
// ============================================================

function renderOrderDetails(
    order
) {

    const items =
        Array.isArray(
            order.items
        )
            ? order.items
            : [];

    return `

        <div class="order-details">

            <div class="order-items">

                <h4>
                    Order Items
                </h4>

                ${
                    items.length
                        ? items.map(
                            item => {

                                const name =
                                    item.name ||
                                    item.product_name ||
                                    "Product";

                                const qty =
                                    numberOrZero(
                                        item.quantity ||
                                        item.qty ||
                                        1
                                    );

                                const price =
                                    numberOrZero(
                                        item.price
                                    );

                                const subtotal =
                                    numberOrZero(
                                        item.subtotal ??
                                        (
                                            price *
                                            qty
                                        )
                                    );

                                return `

                                    <div class="order-item">

                                        <div>

                                            <strong>
                                                ${escapeHtml(
                                                    name
                                                )}
                                            </strong>

                                            <small>
                                                ${qty}
                                                ×
                                                ${money(
                                                    price
                                                )}
                                            </small>

                                        </div>

                                        <strong>
                                            ${money(
                                                subtotal
                                            )}
                                        </strong>

                                    </div>

                                `;

                            }
                        ).join("")
                        :
                        `
                        <div class="order-note">
                            No item details available.
                        </div>
                        `
                }

            </div>


            <div class="order-total">

                <span>
                    Subtotal
                </span>

                <strong>
                    ${money(
                        order.subtotal
                    )}
                </strong>

            </div>


            <div class="order-total">

                <span>
                    Delivery
                </span>

                <strong>
                    ${money(
                        order.delivery_charge
                    )}
                </strong>

            </div>


            <div class="order-grand-total">

                <span>
                    Grand Total
                </span>

                <strong>
                    ${money(
                        order.total
                    )}
                </strong>

            </div>


            ${
                order.payment_method
                    ? `
                    <div class="order-note">
                        💳
                        Payment:
                        <strong>
                            ${escapeHtml(
                                order.payment_method
                            )}
                        </strong>
                    </div>
                    `
                    : ""
            }


            ${
                order.note
                    ? `
                    <div class="order-note">
                        📝
                        <strong>
                            Customer Note
                        </strong>
                        <br>
                        ${escapeHtml(
                            order.note
                        )}
                    </div>
                    `
                    : ""
            }


            <div class="order-status-control">

                <label>
                    Update Status
                </label>

                <select
                    class="order-status-select"
                    data-status-order="${escapeHtml(
                        order.id
                    )}"
                >

                    ${[
                        "pending",
                        "confirmed",
                        "processing",
                        "shipped",
                        "delivered",
                        "cancelled"
                    ]
                        .map(
                            option => `
                            <option
                                value="${option}"
                                ${
                                    normalizeOrderStatus(
                                        order.status
                                    ) === option
                                        ? "selected"
                                        : ""
                                }
                            >
                                ${orderStatusLabel(
                                    option
                                )}
                            </option>
                            `
                        )
                        .join("")}

                </select>

                <button
                    type="button"
                    class="primary-btn"
                    data-update-status="${escapeHtml(
                        order.id
                    )}"
                >
                    Update
                </button>

            </div>

        </div>

    `;
}


// ============================================================
// TOGGLE ORDER
// ============================================================

function toggleOrder(
    id
) {

    if (
        expandedOrders.has(id)
    ) {

        expandedOrders.delete(id);

    } else {

        expandedOrders.add(id);
    }

    renderOrders();
}


// ============================================================
// UPDATE ORDER STATUS
// ============================================================

async function updateOrderStatus(
    id
) {

    const select =
        document.querySelector(
            `[data-status-order="${CSS.escape(
                id
            )}"]`
        );

    if (!select) return;

    const newStatus =
        normalizeOrderStatus(
            select.value
        );

    try {

        const {
            error
        } =
            await supabaseClient
                .from("orders")
                .update({
                    status:
                        newStatus
                })
                .eq(
                    "id",
                    id
                );

        if (error) {
            throw error;
        }

        const order =
            allOrders.find(
                item =>
                    item.id === id
            );

        if (order) {
            order.status =
                newStatus;
        }

        renderOrderDashboard();

        renderOrders();

        showMessage(
            "ordersMessage",
            "✅ Order status updated.",
            "success"
        );

    } catch (error) {

        console.error(
            "ORDER STATUS ERROR:",
            error
        );

        showMessage(
            "ordersMessage",
            "Status update failed: " +
            error.message,
            "error"
        );
    }
}


// ============================================================
// CALL CUSTOMER
// ============================================================

function callOrderCustomer(
    id
) {

    const order =
        allOrders.find(
            item =>
                item.id === id
        );

    if (!order?.phone) {

        alert(
            "Customer phone number পাওয়া যায়নি।"
        );

        return;
    }

    window.location.href =
        "tel:" +
        order.phone;
}


// ============================================================
// COPY ORDER NUMBER
// ============================================================

async function copyOrderNumber(
    id
) {

    const order =
        allOrders.find(
            item =>
                item.id === id
        );

    if (!order) return;

    const number =
        getOrderNumber(
            order
        );

    try {

        await navigator.clipboard.writeText(
            number
        );

        showMessage(
            "ordersMessage",
            "📋 Order number copied.",
            "success"
        );

    } catch {

        prompt(
            "Copy order number:",
            number
        );
    }
}


// ============================================================
// NOTIFICATIONS
// ============================================================

async function requestNotificationPermission() {

    if (
        !("Notification" in window)
    ) {

        alert(
            "এই browser notifications support করে না।"
        );

        return;
    }

    try {

        const permission =
            await Notification.requestPermission();

        if (
            permission === "granted"
        ) {

            showBrowserNotification(
                "মনা ভ্যারাইটি স্টোর",
                "Notification enabled successfully."
            );

            showMessage(
                "ordersMessage",
                "🔔 Notifications enabled.",
                "success"
            );

        } else {

            showMessage(
                "ordersMessage",
                "Notification permission দেওয়া হয়নি।",
                "error"
            );
        }

    } catch (error) {

        console.error(
            "NOTIFICATION ERROR:",
            error
        );
    }
}


function showBrowserNotification(
    title,
    body
) {

    if (
        !("Notification" in window)
    ) {
        return;
    }

    if (
        Notification.permission !==
        "granted"
    ) {
        return;
    }

    try {

        new Notification(
            title,
            {
                body,
                icon:
                    getValue("logoUrl") ||
                    undefined
            }
        );

    } catch (error) {

        console.error(
            "BROWSER NOTIFICATION ERROR:",
            error
        );
    }
}


// ============================================================
// NEW ORDER SOUND
// ============================================================

function playOrderSound() {

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContext) {
            return;
        }

        const ctx =
            new AudioContext();

        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();

        oscillator.type =
            "sine";

        oscillator.frequency.setValueAtTime(
            880,
            ctx.currentTime
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            1320,
            ctx.currentTime + 0.15
        );

        gain.gain.setValueAtTime(
            0.0001,
            ctx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.25,
            ctx.currentTime + 0.02
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + 0.45
        );

        oscillator.connect(
            gain
        );

        gain.connect(
            ctx.destination
        );

        oscillator.start();

        oscillator.stop(
            ctx.currentTime + 0.45
        );

    } catch (error) {

        console.warn(
            "Order sound unavailable:",
            error
        );
    }
}


// ============================================================
// NEW ORDER TOAST
// ============================================================

function showNewOrderToast(
    orders
) {

    const existing =
        document.getElementById(
            "newOrderToast"
        );

    if (existing) {
        existing.remove();
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.id =
        "newOrderToast";

    toast.className =
        "new-order-toast";

    toast.innerHTML = `

        <div class="toast-icon">
            🔔
        </div>

        <div class="toast-content">

            <strong>
                নতুন Order এসেছে!
            </strong>

            <span>
                ${orders.length}
                টি নতুন pending order
            </span>

        </div>

        <button
            type="button"
            id="toastOrdersBtn"
        >
            View
        </button>

        <button
            type="button"
            class="toast-close"
            id="toastCloseBtn"
        >
            ×
        </button>

    `;

    document.body.appendChild(
        toast
    );

    document
        .getElementById(
            "toastOrdersBtn"
        )
        ?.addEventListener(
            "click",
            () => {

                openAdminSection(
                    "orderSection"
                );

                toast.remove();

            }
        );

    document
        .getElementById(
            "toastCloseBtn"
        )
        ?.addEventListener(
            "click",
            () => {

                toast.remove();

            }
        );

    setTimeout(
        () => {

            toast
                ?.classList
                .add(
                    "show"
                );

        },
        50
    );

    setTimeout(
        () => {

            toast
                ?.remove();

        },
        10000
    );
}


// ============================================================
// NOTIFY NEW ORDERS
// ============================================================

function notifyNewOrders(
    orders
) {

    playOrderSound();

    showNewOrderToast(
        orders
    );

    showBrowserNotification(
        "🛍️ নতুন Order এসেছে!",
        `${orders.length} টি নতুন order এসেছে।`
    );
}


// ============================================================
// ORDER POLLING
// ============================================================

function startOrderPolling() {

    stopOrderPolling();

    orderPollTimer =
        setInterval(
            () => {

                loadOrders(
                    true
                );

            },
            30000
        );

    console.log(
        "✅ Order polling started"
    );
}


function stopOrderPolling() {

    if (
        orderPollTimer
    ) {

        clearInterval(
            orderPollTimer
        );

        orderPollTimer =
            null;
    }
}


// ============================================================
// OPTIONAL SUPABASE REALTIME
// ============================================================

function setupOptionalRealtime() {

    if (
        !supabaseClient
    ) {
        return;
    }

    try {

        realtimeChannel =
            supabaseClient
                .channel(
                    "admin-orders-live"
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "orders"
                    },
                    payload => {

                        console.log(
                            "Realtime order event:",
                            payload
                        );

                        loadOrders(
                            true
                        );

                    }
                )
                .subscribe(
                    status => {

                        console.log(
                            "Realtime status:",
                            status
                        );

                    }
                );

    } catch (error) {

        console.warn(
            "Realtime unavailable. Polling will continue.",
            error
        );
    }
}


// ============================================================
// END PART 2
// ============================================================
// PART 3 এর কোড এর ঠিক নিচে paste করবে.
// ============================================================// ============================================================
// MONA VARIETY STORE - PREMIUM ADMIN.JS
// PART 3/3
// ============================================================


// ============================================================
// WHATSAPP
// ============================================================

function cleanPhoneNumber(phone) {

    let value =
        String(phone || "")
            .replace(/\D/g, "");

    if (value.startsWith("01")) {
        value =
            "88" + value;
    }

    return value;
}


function createOrderWhatsAppMessage(order) {

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];

    let message =
        `🛍️ *মনা ভ্যারাইটি স্টোর*\n\n`;

    message +=
        `📦 *Order:* ${getOrderNumber(order)}\n`;

    message +=
        `👤 *Customer:* ${order.customer_name || ""}\n`;

    message +=
        `📞 *Phone:* ${order.phone || ""}\n`;

    if (order.address) {

        message +=
            `📍 *Address:* ${order.address}\n`;
    }

    message += `\n🛒 *Products:*\n`;

    items.forEach((item, index) => {

        const name =
            item.name ||
            item.product_name ||
            "Product";

        const qty =
            numberOrZero(
                item.quantity ||
                item.qty ||
                1
            );

        const price =
            numberOrZero(
                item.price
            );

        const subtotal =
            numberOrZero(
                item.subtotal ??
                price * qty
            );

        message +=
            `${index + 1}. ${name} × ${qty} = ${money(subtotal)}\n`;
    });

    message += `\n`;

    message +=
        `💰 Subtotal: ${money(order.subtotal)}\n`;

    message +=
        `🚚 Delivery: ${money(order.delivery_charge)}\n`;

    message +=
        `💵 *Total: ${money(order.total)}*\n`;

    if (order.payment_method) {

        message +=
            `💳 Payment: ${order.payment_method}\n`;
    }

    if (order.note) {

        message +=
            `📝 Note: ${order.note}\n`;
    }

    message +=
        `\nধন্যবাদ ❤️\nমনা ভ্যারাইটি স্টোর`;

    return message;
}


function openOrderWhatsApp(id) {

    const order =
        allOrders.find(
            item => item.id === id
        );

    if (!order) return;

    const phone =
        cleanPhoneNumber(
            order.phone
        );

    if (!phone) {

        alert(
            "Customer WhatsApp number পাওয়া যায়নি।"
        );

        return;
    }

    const message =
        createOrderWhatsAppMessage(
            order
        );

    const url =
        "https://wa.me/" +
        phone +
        "?text=" +
        encodeURIComponent(
            message
        );

    window.open(
        url,
        "_blank"
    );
}


// ============================================================
// PRINT ORDER
// ============================================================

function printOrder(id) {

    const order =
        allOrders.find(
            item => item.id === id
        );

    if (!order) return;

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];

    const itemRows =
        items.map(item => {

            const name =
                item.name ||
                item.product_name ||
                "Product";

            const qty =
                numberOrZero(
                    item.quantity ||
                    item.qty ||
                    1
                );

            const price =
                numberOrZero(
                    item.price
                );

            const subtotal =
                numberOrZero(
                    item.subtotal ??
                    price * qty
                );

            return `
                <tr>
                    <td>
                        ${escapeHtml(name)}
                    </td>

                    <td>
                        ${qty}
                    </td>

                    <td>
                        ${money(price)}
                    </td>

                    <td>
                        ${money(subtotal)}
                    </td>
                </tr>
            `;

        }).join("");


    const popup =
        window.open(
            "",
            "_blank",
            "width=800,height=900"
        );

    if (!popup) {

        alert(
            "Popup blocked. Browser থেকে popup allow করুন।"
        );

        return;
    }


    popup.document.write(`

        <!DOCTYPE html>

        <html lang="bn">

        <head>

            <meta charset="UTF-8">

            <title>
                ${escapeHtml(
                    getOrderNumber(order)
                )}
            </title>

            <style>

                * {
                    box-sizing: border-box;
                }

                body {
                    font-family:
                        Arial,
                        "Noto Sans Bengali",
                        sans-serif;

                    margin: 0;
                    padding: 30px;

                    color: #111;

                    background: #fff;
                }

                .invoice {
                    max-width: 720px;
                    margin: auto;
                }

                .header {
                    text-align: center;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #111;
                }

                .header h1 {
                    margin: 0 0 6px;
                    font-size: 28px;
                }

                .header p {
                    margin: 4px 0;
                }

                .order-info {
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                    margin: 20px 0;
                }

                .customer {
                    line-height: 1.7;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                th,
                td {
                    border: 1px solid #ccc;
                    padding: 10px;
                    text-align: left;
                }

                th {
                    background: #f2f2f2;
                }

                .totals {
                    margin-top: 20px;
                    margin-left: auto;
                    max-width: 320px;
                }

                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 7px 0;
                }

                .grand {
                    font-size: 20px;
                    font-weight: bold;
                    border-top: 2px solid #111;
                    margin-top: 8px;
                    padding-top: 12px;
                }

                .note {
                    margin-top: 20px;
                    padding: 12px;
                    background: #f7f7f7;
                }

                .footer {
                    text-align: center;
                    margin-top: 35px;
                    padding-top: 15px;
                    border-top: 1px solid #ccc;
                }

                @media print {

                    body {
                        padding: 0;
                    }

                    .no-print {
                        display: none;
                    }
                }

            </style>

        </head>

        <body>

            <div class="invoice">

                <div class="header">

                    <h1>
                        মনা ভ্যারাইটি স্টোর
                    </h1>

                    <p>
                        আপনাদের আস্থার সাথে ৭১ বছর
                    </p>

                    <p>
                        Order Invoice
                    </p>

                </div>


                <div class="order-info">

                    <div class="customer">

                        <strong>
                            Order:
                        </strong>

                        ${escapeHtml(
                            getOrderNumber(order)
                        )}

                        <br>

                        <strong>
                            Date:
                        </strong>

                        ${escapeHtml(
                            formatOrderDate(
                                order.created_at
                            )
                        )}

                    </div>


                    <div class="customer">

                        <strong>
                            Customer:
                        </strong>

                        ${escapeHtml(
                            order.customer_name ||
                            ""
                        )}

                        <br>

                        <strong>
                            Phone:
                        </strong>

                        ${escapeHtml(
                            order.phone ||
                            ""
                        )}

                        <br>

                        <strong>
                            Address:
                        </strong>

                        ${escapeHtml(
                            order.address ||
                            ""
                        )}

                    </div>

                </div>


                <table>

                    <thead>

                        <tr>

                            <th>
                                Product
                            </th>

                            <th>
                                Qty
                            </th>

                            <th>
                                Price
                            </th>

                            <th>
                                Total
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${itemRows}

                    </tbody>

                </table>


                <div class="totals">

                    <div class="total-row">

                        <span>
                            Subtotal
                        </span>

                        <strong>
                            ${money(
                                order.subtotal
                            )}
                        </strong>

                    </div>


                    <div class="total-row">

                        <span>
                            Delivery
                        </span>

                        <strong>
                            ${money(
                                order.delivery_charge
                            )}
                        </strong>

                    </div>


                    <div class="total-row grand">

                        <span>
                            Total
                        </span>

                        <strong>
                            ${money(
                                order.total
                            )}
                        </strong>

                    </div>

                </div>


                ${
                    order.payment_method
                        ? `
                        <div class="note">

                            <strong>
                                Payment:
                            </strong>

                            ${escapeHtml(
                                order.payment_method
                            )}

                        </div>
                        `
                        : ""
                }


                ${
                    order.note
                        ? `
                        <div class="note">

                            <strong>
                                Customer Note:
                            </strong>

                            <br>

                            ${escapeHtml(
                                order.note
                            )}

                        </div>
                        `
                        : ""
                }


                <div class="footer">

                    ধন্যবাদ ❤️

                    <br>

                    মনা ভ্যারাইটি স্টোর

                </div>

            </div>


            <script>

                window.onload = function() {

                    setTimeout(
                        function() {
                            window.print();
                        },
                        400
                    );

                };

            <\/script>

        </body>

        </html>

    `);

    popup.document.close();
}


// ============================================================
// ORDER SEARCH
// ============================================================

function handleOrderSearch() {

    renderOrders();
}


// ============================================================
// PRODUCT SEARCH
// ============================================================

function handleProductSearch() {

    renderProductList();
}


// ============================================================
// OPEN ADMIN SECTION
// ============================================================

function openAdminSection(
    sectionId
) {

    const sections =
        document.querySelectorAll(
            ".admin-section"
        );

    sections.forEach(section => {

        section.style.display =
            "none";

    });


    const target =
        $(sectionId);

    if (target) {

        target.style.display =
            "block";
    }


    const buttons =
        document.querySelectorAll(
            "[data-section]"
        );

    buttons.forEach(button => {

        button.classList.remove(
            "active"
        );

        if (
            button.dataset.section ===
            sectionId
        ) {

            button.classList.add(
                "active"
            );
        }

    });


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ============================================================
// EVENT BINDING
// ============================================================

function bindEvents() {


    // --------------------------------------------------------
    // LOGIN
    // --------------------------------------------------------

    $("loginBtn")
        ?.addEventListener(
            "click",
            login
        );


    $("loginPassword")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    login();
                }

            }
        );


    // --------------------------------------------------------
    // LOGOUT
    // --------------------------------------------------------

    $("logoutBtn")
        ?.addEventListener(
            "click",
            logout
        );


    // --------------------------------------------------------
    // STORE
    // --------------------------------------------------------

    $("saveStoreBtn")
        ?.addEventListener(
            "click",
            saveStoreSettings
        );


    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    $("saveCategoryBtn")
        ?.addEventListener(
            "click",
            saveCategory
        );


    $("categoryList")
        ?.addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        "[data-delete-category]"
                    );

                if (!button) return;

                deleteCategory(
                    button.dataset.deleteCategory
                );

            }
        );


    // --------------------------------------------------------
    // PRODUCTS
    // --------------------------------------------------------

    $("saveProductBtn")
        ?.addEventListener(
            "click",
            saveProduct
        );


    $("cancelProductBtn")
        ?.addEventListener(
            "click",
            resetProductForm
        );


    $("productSearch")
        ?.addEventListener(
            "input",
            handleProductSearch
        );


    $("productFilterCategory")
        ?.addEventListener(
            "change",
            handleProductSearch
        );


    $("productList")
        ?.addEventListener(
            "click",
            event => {

                const editButton =
                    event.target.closest(
                        "[data-edit-product]"
                    );

                if (editButton) {

                    editProduct(
                        editButton.dataset.editProduct
                    );

                    return;
                }


                const deleteButton =
                    event.target.closest(
                        "[data-delete-product]"
                    );

                if (deleteButton) {

                    deleteProduct(
                        deleteButton.dataset.deleteProduct
                    );

                }

            }
        );


    // --------------------------------------------------------
    // PAYMENTS
    // --------------------------------------------------------

    $("savePaymentsBtn")
        ?.addEventListener(
            "click",
            savePayments
        );


    // --------------------------------------------------------
    // ORDERS
    // --------------------------------------------------------

    $("refreshOrdersBtn")
        ?.addEventListener(
            "click",
            async () => {

                const button =
                    $("refreshOrdersBtn");

                setButtonLoading(
                    button,
                    true,
                    "Refreshing..."
                );

                try {

                    await loadOrders(
                        false
                    );

                    showMessage(
                        "ordersMessage",
                        "✅ Orders refreshed.",
                        "success"
                    );

                } finally {

                    setButtonLoading(
                        button,
                        false
                    );

                }

            }
        );


    $("orderSearch")
        ?.addEventListener(
            "input",
            handleOrderSearch
        );


    $("orderStatusFilter")
        ?.addEventListener(
            "change",
            handleOrderSearch
        );


    $("ordersList")
        ?.addEventListener(
            "click",
            event => {

                const toggle =
                    event.target.closest(
                        "[data-toggle-order]"
                    );

                if (toggle) {

                    toggleOrder(
                        toggle.dataset.toggleOrder
                    );

                    return;
                }


                const call =
                    event.target.closest(
                        "[data-call-order]"
                    );

                if (call) {

                    callOrderCustomer(
                        call.dataset.callOrder
                    );

                    return;
                }


                const whatsapp =
                    event.target.closest(
                        "[data-whatsapp-order]"
                    );

                if (whatsapp) {

                    openOrderWhatsApp(
                        whatsapp.dataset.whatsappOrder
                    );

                    return;
                }


                const print =
                    event.target.closest(
                        "[data-print-order]"
                    );

                if (print) {

                    printOrder(
                        print.dataset.printOrder
                    );

                    return;
                }


                const update =
                    event.target.closest(
                        "[data-update-status]"
                    );

                if (update) {

                    updateOrderStatus(
                        update.dataset.updateStatus
                    );

                }

            }
        );


    // --------------------------------------------------------
    // NOTIFICATION BUTTON
    // --------------------------------------------------------

    document.addEventListener(
        "click",
        event => {

            if (
                event.target.closest(
                    "#enableNotificationsBtn"
                )
            ) {

                requestNotificationPermission();

            }

        }
    );


    // --------------------------------------------------------
    // SIDEBAR / DATA SECTION
    // --------------------------------------------------------

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-section]"
                );

            if (!button) return;

            const section =
                button.dataset.section;

            if (!section) return;

            openAdminSection(
                section
            );

        }
    );


    // --------------------------------------------------------
    // VIEW STORE
    // --------------------------------------------------------

    $("viewStoreBtn")
        ?.addEventListener(
            "click",
            () => {

                window.location.href =
                    "index.html";

            }
        );


    // --------------------------------------------------------
    // COPY ORDER NUMBER
    // --------------------------------------------------------

    $("ordersList")
        ?.addEventListener(
            "dblclick",
            event => {

                const card =
                    event.target.closest(
                        "[data-order-id]"
                    );

                if (!card) return;

                copyOrderNumber(
                    card.dataset.orderId
                );

            }
        );

}


// ============================================================
// AUTH STATE LISTENER
// ============================================================

function setupAuthListener() {

    if (!supabaseClient) {
        return;
    }

    supabaseClient.auth
        .onAuthStateChange(
            async (
                event,
                session
            ) => {

                console.log(
                    "AUTH EVENT:",
                    event
                );


                if (
                    event ===
                    "SIGNED_OUT"
                ) {

                    currentUser =
                        null;

                    stopOrderPolling();

                    showLogin();

                    return;
                }


                if (
                    event ===
                    "SIGNED_IN" &&
                    session?.user
                ) {

                    currentUser =
                        session.user;

                    const isAdmin =
                        await checkAdmin();

                    if (!isAdmin) {

                        showLogin();

                        return;
                    }

                    showAdminPanel();

                    await loadAllAdminData();

                    startOrderPolling();

                    setupOptionalRealtime();

                }

            }
        );
}


// ============================================================
// PREMIUM ADMIN CSS
// ============================================================

function injectPremiumAdminStyles() {

    if (
        document.getElementById(
            "premiumAdminStyles"
        )
    ) {
        return;
    }


    const style =
        document.createElement(
            "style"
        );

    style.id =
        "premiumAdminStyles";


    style.textContent = `

        /* ====================================================
           MESSAGES
        ==================================================== */

        .admin-message {

            display: none;

            margin: 12px 0;

            padding: 12px 15px;

            border-radius: 12px;

            font-weight: 700;

        }


        .admin-message.success {

            display: block;

            background: rgba(
                22,
                163,
                74,
                .12
            );

            border: 1px solid rgba(
                22,
                163,
                74,
                .25
            );

            color: #15803d;

        }


        .admin-message.error {

            display: block;

            background: rgba(
                220,
                38,
                38,
                .12
            );

            border: 1px solid rgba(
                220,
                38,
                38,
                .25
            );

            color: #b91c1c;

        }


        /* ====================================================
           EMPTY
        ==================================================== */

        .admin-empty {

            padding: 35px 20px;

            text-align: center;

            border: 1px dashed #d1d5db;

            border-radius: 18px;

            color: #6b7280;

            display: flex;

            flex-direction: column;

            gap: 7px;

            align-items: center;

            justify-content: center;

        }


        .empty-icon {

            font-size: 38px;

            margin-bottom: 5px;

        }


        /* ====================================================
           CATEGORY
        ==================================================== */

        .category-card {

            display: flex;

            align-items: center;

            gap: 14px;

            padding: 15px;

            margin-bottom: 10px;

            border-radius: 16px;

            background: #fff;

            border: 1px solid #e5e7eb;

            transition:
                .2s ease;

        }


        .category-card:hover {

            transform:
                translateY(-2px);

            box-shadow:
                0 10px 30px
                rgba(
                    0,
                    0,
                    0,
                    .08
                );

        }


        .category-icon {

            width: 48px;

            height: 48px;

            display: flex;

            align-items: center;

            justify-content: center;

            border-radius: 14px;

            background: #111;

            color: #fff;

            font-size: 24px;

        }


        .category-info {

            flex: 1;

            display: flex;

            flex-direction: column;

            gap: 4px;

        }


        .category-info strong {

            font-size: 15px;

        }


        .category-info small {

            color: #777;

        }


        /* ====================================================
           PRODUCT
        ==================================================== */

        .product-row {

            display: flex;

            align-items: center;

            gap: 15px;

            padding: 15px;

            margin-bottom: 12px;

            background: #fff;

            border:
                1px solid #e5e7eb;

            border-radius: 18px;

            transition:
                .2s ease;

        }


        .product-row:hover {

            transform:
                translateY(-2px);

            box-shadow:
                0 12px 35px
                rgba(
                    0,
                    0,
                    0,
                    .08
                );

        }


        .product-image-wrap {

            flex:
                0 0 75px;

        }


        .product-admin-image,
        .product-placeholder {

            width: 75px;

            height: 75px;

            object-fit: cover;

            border-radius: 15px;

            background: #f3f4f6;

            display: flex;

            align-items: center;

            justify-content: center;

        }


        .product-main {

            flex: 1;

            min-width: 0;

        }


        .product-main h3 {

            margin:
                0 0 5px;

            font-size: 16px;

        }


        .product-meta {

            color: #777;

            font-size: 13px;

        }


        .product-price {

            margin-top: 6px;

            font-weight: 800;

            font-size: 16px;

        }


        .product-price del {

            margin-left: 7px;

            color: #999;

            font-weight: 400;

            font-size: 13px;

        }


        .product-badges {

            display: flex;

            flex-wrap: wrap;

            gap: 5px;

            margin-top: 7px;

        }


        .badge {

            padding: 4px 8px;

            border-radius: 999px;

            font-size: 11px;

            font-weight: 800;

            background: #111;

            color: #fff;

        }


        .badge.active {

            background: #15803d;

        }


        .badge.inactive {

            background: #b91c1c;

        }


        .product-stock {

            white-space: nowrap;

            font-size: 13px;

            color: #666;

        }


        .product-actions {

            display: flex;

            gap: 7px;

            flex-wrap: wrap;

        }


        /* ====================================================
           PAYMENT
        ==================================================== */

        .payment-row {

            display: flex;

            gap: 15px;

            align-items: center;

            padding: 15px;

            margin-bottom: 12px;

            border:
                1px solid #e5e7eb;

            border-radius: 18px;

            background: #fff;

        }


        .payment-info {

            flex: 1;

            display: grid;

            gap: 8px;

        }


        .payment-info input,
        .payment-info textarea {

            width: 100%;

            padding: 10px 12px;

            border:
                1px solid #ddd;

            border-radius: 10px;

            outline: none;

        }


        .payment-info textarea {

            min-height: 70px;

            resize: vertical;

        }


        .payment-toggle {

            display: flex;

            align-items: center;

            gap: 7px;

            white-space: nowrap;

        }


        /* ====================================================
           ORDER DASHBOARD
        ==================================================== */

        #orderDashboard {

            display: grid;

            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(
                        150px,
                        1fr
                    )
                );

            gap: 12px;

            margin-bottom: 18px;

        }


        .order-stat-card {

            display: flex;

            align-items: center;

            gap: 12px;

            padding: 17px;

            background: #fff;

            border:
                1px solid #e5e7eb;

            border-radius: 18px;

            box-shadow:
                0 8px 25px
                rgba(
                    0,
                    0,
                    0,
                    .05
                );

        }


        .stat-icon {

            width: 45px;

            height: 45px;

            display: flex;

            align-items: center;

            justify-content: center;

            border-radius: 13px;

            background: #111;

            color: #fff;

            font-size: 21px;

        }


        .order-stat-card small {

            display: block;

            color: #777;

            font-size: 11px;

        }


        .order-stat-card strong {

            display: block;

            margin-top: 2px;

            font-size: 22px;

        }


        .notification-btn {

            border: 0;

            border-radius: 16px;

            padding: 12px 15px;

            font-weight: 800;

            cursor: pointer;

            background: #111;

            color: #fff;

            min-height: 58px;

        }


        /* ====================================================
           ORDER CARD
        ==================================================== */

        .order-card {

            background: #fff;

            border:
                1px solid #e5e7eb;

            border-radius: 22px;

            margin-bottom: 15px;

            padding: 17px;

            box-shadow:
                0 10px 30px
                rgba(
                    0,
                    0,
                    0,
                    .05
                );

            overflow: hidden;

            transition:
                .25s ease;

        }


        .order-card:hover {

            box-shadow:
                0 16px 40px
                rgba(
                    0,
                    0,
                    0,
                    .09
                );

        }


        .order-card-head {

            display: flex;

            justify-content: space-between;

            align-items: flex-start;

            gap: 12px;

        }


        .order-number {

            font-weight: 900;

            font-size: 17px;

        }


        .order-date {

            margin-top: 4px;

            color: #777;

            font-size: 12px;

        }


        .order-status {

            padding: 6px 10px;

            border-radius: 999px;

            font-size: 11px;

            font-weight: 900;

            background: #f3f4f6;

            color: #333;

        }


        .status-pending {

            background: #fef3c7;

            color: #92400e;

        }


        .status-confirmed {

            background: #dbeafe;

            color: #1d4ed8;

        }


        .status-processing {

            background: #ede9fe;

            color: #6d28d9;

        }


        .status-shipped {

            background: #cffafe;

            color: #0e7490;

        }


        .status-delivered {

            background: #dcfce7;

            color: #15803d;

        }


        .status-cancelled {

            background: #fee2e2;

            color: #b91c1c;

        }


        .order-customer {

            display: flex;

            gap: 11px;

            margin-top: 17px;

            padding-top: 15px;

            border-top:
                1px solid #eee;

        }


        .customer-avatar {

            width: 45px;

            height: 45px;

            flex:
                0 0 45px;

            display: flex;

            align-items: center;

            justify-content: center;

            border-radius: 50%;

            background: #111;

            color: #fff;

            font-weight: 900;

        }


        .customer-info {

            display: flex;

            flex-direction: column;

            gap: 3px;

            min-width: 0;

        }


        .customer-info strong {

            font-size: 15px;

        }


        .customer-info a {

            color: inherit;

            text-decoration: none;

            font-size: 13px;

        }


        .customer-info span {

            color: #666;

            font-size: 12px;

            word-break: break-word;

        }


        .order-summary-line {

            display: flex;

            align-items: center;

            justify-content: space-between;

            padding-top: 15px;

            margin-top: 15px;

            border-top:
                1px solid #eee;

        }


        .order-summary-line span {

            color: #666;

            font-size: 13px;

        }


        .order-summary-line strong {

            font-size: 20px;

        }


        /* ====================================================
           ORDER DETAILS
        ==================================================== */

        .order-details {

            margin-top: 15px;

            padding-top: 15px;

            border-top:
                1px solid #eee;

        }


        .order-items h4 {

            margin:
                0 0 10px;

        }


        .order-item {

            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 15px;

            padding: 11px 0;

            border-bottom:
                1px dashed #ddd;

        }


        .order-item > div {

            display: flex;

            flex-direction: column;

            gap: 4px;

        }


        .order-item small {

            color: #777;

        }


        .order-total {

            display: flex;

            justify-content: space-between;

            padding-top: 9px;

            color: #555;

        }


        .order-grand-total {

            display: flex;

            justify-content: space-between;

            padding-top: 13px;

            margin-top: 8px;

            border-top:
                2px solid #111;

            font-size: 18px;

            font-weight: 900;

        }


        .order-note {

            margin-top: 14px;

            padding: 12px;

            border-radius: 12px;

            background: #f8f8f8;

            font-size: 13px;

            line-height: 1.6;

        }


        .order-status-control {

            display: flex;

            align-items: center;

            gap: 8px;

            margin-top: 15px;

            padding-top: 15px;

            border-top:
                1px solid #eee;

        }


        .order-status-control label {

            font-size: 12px;

            font-weight: 800;

        }


        .order-status-select {

            flex: 1;

            min-width: 0;

            padding: 10px;

            border:
                1px solid #ddd;

            border-radius: 10px;

            background: #fff;

        }


        /* ====================================================
           ORDER ACTIONS
        ==================================================== */

        .order-actions {

            display: flex;

            flex-wrap: wrap;

            gap: 8px;

            margin-top: 15px;

        }


        .order-actions button,
        .primary-btn,
        .secondary-btn,
        .danger-btn,
        .edit-btn,
        .whatsapp-order-btn {

            border: 0;

            border-radius: 11px;

            padding: 10px 13px;

            font-weight: 800;

            cursor: pointer;

            transition:
                .2s ease;

        }


        .primary-btn {

            background: #111;

            color: #fff;

        }


        .secondary-btn {

            background: #f3f4f6;

            color: #111;

        }


        .edit-btn {

            background: #111;

            color: #fff;

        }


        .danger-btn {

            background: #fee2e2;

            color: #b91c1c;

        }


        .whatsapp-order-btn {

            background: #15803d;

            color: #fff;

        }


        .order-actions button:hover,
        .primary-btn:hover,
        .secondary-btn:hover,
        .danger-btn:hover,
        .edit-btn:hover,
        .whatsapp-order-btn:hover {

            transform:
                translateY(-1px);

        }


        /* ====================================================
           NEW ORDER TOAST
        ==================================================== */

        .new-order-toast {

            position: fixed;

            right: 18px;

            bottom: 18px;

            z-index: 99999;

            width:
                min(
                    390px,
                    calc(
                        100vw - 36px
                    )
                );

            display: flex;

            align-items: center;

            gap: 11px;

            padding: 14px;

            background: #111;

            color: #fff;

            border-radius: 18px;

            box-shadow:
                0 20px 60px
                rgba(
                    0,
                    0,
                    0,
                    .25
                );

            transform:
                translateY(
                    130px
                );

            opacity: 0;

            transition:
                .3s ease;

        }


        .new-order-toast.show {

            transform:
                translateY(0);

            opacity: 1;

        }


        .toast-icon {

            font-size: 27px;

        }


        .toast-content {

            flex: 1;

            display: flex;

            flex-direction: column;

            gap: 3px;

        }


        .toast-content span {

            font-size: 12px;

            opacity: .75;

        }


        .new-order-toast button {

            border: 0;

            border-radius: 9px;

            padding: 8px 10px;

            font-weight: 800;

            cursor: pointer;

        }


        .toast-close {

            background: transparent !important;

            color: #fff;

            font-size: 18px;

        }


        /* ====================================================
           SPINNER
        ==================================================== */

        .admin-spinner {

            width: 14px;

            height: 14px;

            display: inline-block;

            border:
                2px solid
                currentColor;

            border-right-color:
                transparent;

            border-radius: 50%;

            animation:
                adminSpin
                .7s linear infinite;

        }


        @keyframes adminSpin {

            to {

                transform:
                    rotate(360deg);

            }

        }


        /* ====================================================
           MOBILE
        ==================================================== */

        @media (
            max-width: 700px
        ) {

            .product-row {

                align-items:
                    flex-start;

                flex-wrap: wrap;

            }


            .product-stock {

                width: 100%;

            }


            .product-actions {

                width: 100%;

            }


            .payment-row {

                flex-direction: column;

                align-items:
                    stretch;

            }


            .payment-toggle {

                justify-content:
                    flex-start;

            }


            .order-card-head {

                flex-direction:
                    column;

            }


            .order-status {

                align-self:
                    flex-start;

            }


            .order-status-control {

                flex-wrap: wrap;

            }


            .order-status-select {

                width: 100%;

                flex: 1 1 100%;

            }


            .order-actions button {

                flex: 1 1 auto;

            }

        }

    `;


    document.head.appendChild(
        style
    );
}


// ============================================================
// GLOBAL ERROR HANDLERS
// ============================================================

window.addEventListener(
    "error",
    event => {

        console.error(
            "GLOBAL ADMIN ERROR:",
            event.error ||
            event.message
        );

    }
);


window.addEventListener(
    "unhandledrejection",
    event => {

        console.error(
            "UNHANDLED ADMIN PROMISE:",
            event.reason
        );

    }
);


// ============================================================
// AUTH LISTENER START
// ============================================================

setTimeout(
    () => {

        setupAuthListener();

    },
    0
);


// ============================================================
// FINAL
// ============================================================

console.log(
    "🚀 Mona Variety Store Premium Admin.js loaded."
);/* ============================================================
   FINAL PRODUCT IMAGE UPLOAD
   SUPABASE STORAGE BUCKET: Product images
   ============================================================ */

async function uploadProductImageIfSelected() {

    const fileInput =
        document.getElementById("productImageUpload");

    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        return null;
    }

    const file = fileInput.files[0];

    if (!file.type.startsWith("image/")) {
        throw new Error("শুধু image file upload করা যাবে।");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image সর্বোচ্চ 5MB হতে হবে।");
    }

    const extension =
        file.name.split(".").pop().toLowerCase();

    const safeName =
        file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-zA-Z0-9-_]/g, "-")
            .toLowerCase();

    const filePath =
        "products/" +
        Date.now() +
        "-" +
        safeName +
        "." +
        extension;

    const { error: uploadError } =
        await supabaseClient.storage
            .from("Product images")
            .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

    if (uploadError) {
        throw uploadError;
    }

    const { data } =
        supabaseClient.storage
            .from("Product images")
            .getPublicUrl(filePath);

    if (!data?.publicUrl) {
        throw new Error(
            "Uploaded image-এর public URL পাওয়া যায়নি।"
        );
    }

    return data.publicUrl;
}


/* ============================================================
   REPLACE SAVE PRODUCT
   ============================================================ */

window.saveProduct = async function () {

    const name =
        getValue("productName");

    const categoryId =
        getValue("productCategory");

    const price =
        numberOrZero(
            getValue("productPrice")
        );

    if (!name) {
        showMessage(
            "productMessage",
            "Product name দিন।",
            "error"
        );
        return;
    }

    if (price <= 0) {
        showMessage(
            "productMessage",
            "Valid price দিন।",
            "error"
        );
        return;
    }

    const button =
        $("saveProductBtn");

    setButtonLoading(
        button,
        true,
        editingProductId
            ? "Updating..."
            : "Saving..."
    );

    try {

        /*
         * Existing image রাখবে যদি নতুন image
         * select না করা হয়।
         */
        let imageUrl =
            getValue("productImage");

        const uploadedImage =
            await uploadProductImageIfSelected();

        if (uploadedImage) {
            imageUrl = uploadedImage;
        }

        const payload = {

            name: name,

            category_id:
                categoryId || null,

            price: price,

            old_price:
                numberOrNull(
                    getValue("productOldPrice")
                ),

            stock:
                numberOrZero(
                    getValue("productStock")
                ),

            image:
                imageUrl || null,

            image_url:
                imageUrl || null,

            description:
                getValue("productDescription"),

            active:
                $("productActive")
                    ? $("productActive").checked
                    : true,

            featured:
                $("productFeatured")
                    ? $("productFeatured").checked
                    : false,

            is_new:
                $("productNew")
                    ? $("productNew").checked
                    : false,

            best_seller:
                $("productBestSeller")
                    ? $("productBestSeller").checked
                    : false,

            discount:
                getValue("productDiscount")
        };


        let result;

        if (editingProductId) {

            result =
                await supabaseClient
                    .from("products")
                    .update(payload)
                    .eq(
                        "id",
                        editingProductId
                    );

        } else {

            result =
                await supabaseClient
                    .from("products")
                    .insert(payload);

        }

        if (result.error) {
            throw result.error;
        }

        showMessage(
            "productMessage",
            editingProductId
                ? "✅ Product updated successfully."
                : "✅ Product added successfully.",
            "success"
        );

        const fileInput =
            $("productImageUpload");

        if (fileInput) {
            fileInput.value = "";
        }

        const preview =
            $("productImagePreview");

        if (preview) {
            preview.removeAttribute("src");
            preview.style.display = "none";
        }

        resetProductForm();

        await loadProducts();

    } catch (error) {

        console.error(
            "FINAL PRODUCT SAVE ERROR:",
            error
        );

        showMessage(
            "productMessage",
            "Save failed: " +
            (
                error?.message ||
                "Unknown error"
            ),
            "error"
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }
};


/* ============================================================
   IMAGE PREVIEW
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const input =
            document.getElementById(
                "productImageUpload"
            );

        const preview =
            document.getElementById(
                "productImagePreview"
            );

        if (!input || !preview) return;

        input.addEventListener(
            "change",
            function () {

                const file =
                    input.files?.[0];

                if (!file) {
                    preview.removeAttribute("src");
                    preview.style.display = "none";
                    return;
                }

                preview.src =
                    URL.createObjectURL(file);

                preview.style.display =
                    "block";
            }
        );

    }
);

# Frontend Locales — i18n Translations — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mục đích](#1-mục-đích)
- [2. Files](#2-files)
- [3. Cấu trúc key](#3-cấu-trúc-key)
- [4. Quy tắc bắt buộc](#4-quy-tắc-bắt-buộc)
- [5. Gotchas](#5-gotchas)

---

# 1. Mục đích

Chứa file translation cho i18n frontend (i18next + react-i18next). Hỗ trợ 2 ngôn ngữ: tiếng Việt (`vi`) và tiếng Anh (`en`).

Ngôn ngữ mặc định: `vi`. User switch ngôn ngữ qua `LanguageSwitcher` component → lưu vào `localStorage('language')`.

---

# 2. Files

| File      | Ngôn ngữ   | Dùng cho                         |
| --------- | ---------- | -------------------------------- |
| `vi.json` | Tiếng Việt | Ngôn ngữ mặc định + fallback     |
| `en.json` | Tiếng Anh  | Ngôn ngữ thứ 2, user switch được |

Cả 2 file **phải có cùng key structure** hoàn toàn. Thiếu key ở 1 file → i18next fallback về `vi`, nếu vi cũng thiếu → hiển thị key thô (ví dụ: `checkout.bankTransfer.title`).

---

# 3. Cấu trúc key

Key tổ chức theo namespace lồng nhau, ánh xạ theo UI section:

```
header:
  brand, tagline, navigation.{home,shop,categories,deals,news,about,...}
  actions.{search,searchPlaceholder,userAccount,shoppingCart,...}
  language.{vietnamese,english,current}
  dropdown.{profile,orders,wishlist,adminPanel,logout}

homepage:
  hero.{title,subtitle,shopNow,slides,buttons,features}
  featuredProducts.{title,viewAll}
  categories.{title,productsCount}
  brands.{title}
  pageTitle, pageDescription, keywords

footer: {...}

auth:
  login.{title,email,password,submit,forgotPassword}
  register.{title,firstName,lastName,...}
  forgotPassword.{title,email,submit}
  logout.{success}
  errors.{invalidCredentials,accountLocked,sessionExpired,...}

catalog:
  product.{name,price,addToCart,buyNow,outOfStock,...}
  category.{all,filter,...}
  brand.{...}
  filter.{...}
  sort.{newest,priceAsc,priceDesc,bestSelling}

cart:
  title, empty, checkout, items, subtotal, discount,...

checkout:
  steps.{cart,info,payment,confirm}
  bankTransfer.{title,instructions,...}
  momo.{title,...}
  vnpay.{title,...}
  shippingInfo.{...}

orders:
  status.{pending,processing,shipped,delivered,cancelled}
  list.{title,empty,...}
  detail.{...}

payment:
  qr.{title,scanInstructions,...}
  status.{pending,success,failed,processing}

profile:
  info.{title,firstName,lastName,email,phone,...}
  address.{title,addNew,edit,delete,...}
  loyalty.{title,points,redeem,...}

reviews: {...}
wishlist: {...}
ai:
  chatbot.{title,placeholder,close,...}
  history.{...}

content:
  news.{title,readMore,...}
  about.{heroTitle,storyTitle,valuesTitle,teamTitle,ctaTitle,...}
  contact.{title,name,email,message,submit,...}

admin:
  dashboard.{title,stats,...}
  products.{title,create,edit,...}
  orders.{title,manage,...}
  users.{title,manage,...}
  verifyingAccess

common:
  save, cancel, delete, edit, add, confirm, close
  loading, error, success, warning, info
  noData, tryAgain, back, next, previous
  currencySymbol (→ "₫")

errors:
  network, validation, authentication, authorization, notFound, server, unknown

notFound:
  title, description, goHome, browseProducts

unauthorized: {...}
about:
  pageTitle, heroTitle, heroSubtitle, storyTitle, storyP1, storyP2, storyP3
  valuesTitle, value1/2/3.{title,description}
  teamTitle, teamMember1/2/3/4.{role}
  ctaTitle, ctaDesc, ctaShopBtn, ctaContactBtn
```

---

# 4. Quy tắc bắt buộc

Tất cả user-visible strings trong frontend PHẢI dùng `t('key')`:

```tsx
const { t } = useTranslation();

// Đúng
<Button>{t('common.save')}</Button>
<p>{t('cart.empty')}</p>
<title>{t('homepage.pageTitle')} | TechStore</title>

// Sai — hardcode
<Button>Lưu</Button>
<p>Cart is empty</p>
```

Khi thêm text mới:

1. Thêm key vào `vi.json` (tiếng Việt)
2. Thêm key vào `en.json` (tiếng Anh)
3. Dùng `t('namespace.key')` trong component

---

# 5. Gotchas

- **i18n init** tại `src/config/i18n.ts` — xem [`src/config/CLAUDE.md`](../config/CLAUDE.md)
- **Backend locales tách biệt** tại `backend/src/locales/` — không liên quan.
- **Key fallback:** i18next fallback về `vi` trước khi hiển thị key thô — nếu `vi.json` có key thì `en.json` thiếu key vẫn hiển thị tiếng Việt (không hiển thị key thô).
- **Interpolation:** `escapeValue: false` — React đã tự escape, không cần i18next escape thêm.
- **Không đặt key quá flat** (`"saveButton": "Lưu"`) — nhóm theo domain để dễ tìm. Sai: `t('saveBtn')`, Đúng: `t('common.save')`.
- **`common.currencySymbol`** = `"₫"` — dùng trong `format.ts` cho fallback currency display.

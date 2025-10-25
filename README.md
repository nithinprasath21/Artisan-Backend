# 🏺 Artisan E-commerce Backend API

This is the backend repository for the Artisan E-commerce Platform, built using **Node.js, Express, and PostgreSQL**. It provides authenticated APIs for Artisan profile management, product listing, inventory control, and more.

## 🚀 Getting Started

Follow these steps to set up the project locally, configure the database, and start the server.

### Prerequisites

Ensure you have the following installed:

* **Node.js (LTS Version)**
* **npm** (Node Package Manager)
* **PostgreSQL** (with command-line tools like `psql`)
* **Git**

---

## 💻 Step 1: Clone and Install

Open your terminal, clone the repository, and install the necessary dependencies.

```bash
# Clone the repository
git clone <YOUR_REPOSITORY_URL>

# Navigate into the project folder
cd artisan-backend

# Install dependencies (Express, pg, jsonwebtoken, bcrypt, multer, etc.)
npm install
```

---

## ⚙️ Step 2: Environment Configuration

You must set up your environment variables for database connection and security keys.

### Create a `.env` file

In the root of the `artisan-backend` directory, create a new file named `.env`.

Add Configuration: Copy the template below and replace the placeholder values (`<... YOUR VALUE ...>`) with your actual configuration details.

```bash
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=artisan_db
DB_PASSWORD=admin
DB_PORT=5432

ENCRYPTION_KEY=a043f8435c17a8969f2c5edb6a8a7de4d15ca2505903d86db3d149d0fe68a92c

JWT_SECRET=78dc707ee967aa3b418afc8776cf1bc341e6622a5fb63f51cc7f8ba42368060c
JWT_ACCESS_TOKEN_EXPIRATION=1h
JWT_REFRESH_TOKEN_EXPIRATION=7d

PORT=5000
```

---

## 🗄️ Step 3: Database Setup

You need to create the database and set up all the required tables, including the columns necessary for inventory and KYC tracking.

### A. Create the Database

Open your terminal and connect to your PostgreSQL server:

```bash
psql -U <YOUR_POSTGRES_USER>
```

Create the database and then exit:

```sql
CREATE DATABASE artisan_ecommerce_db;
\q
```

### B. Create Tables and Schema

Connect to the new database and run the following SQL commands sequentially.

```bash
psql -U <YOUR_POSTGRES_USER> -d artisan_ecommerce_db
```

#### 1. Core Tables (Users, Artisans, Categories)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    phone_number VARCHAR(20) UNIQUE,
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('customer', 'artisan', 'admin_staff', 'artisan_hub')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending_kyc', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE TABLE artisans (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    profile_picture_url VARCHAR(2048),
    craft_type_id UUID,
    region_id UUID,
    kyc_status VARCHAR(50) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
    rejection_reason TEXT,
    bank_account_holder_name VARCHAR(255),
    pan_card_number VARCHAR(20),
    bank_account_name VARCHAR(255),
    bank_account_number_encrypted TEXT,
    bank_ifsc_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    icon_url VARCHAR(2048)
);
```

#### 2. Product and Related Tables

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'out_of_stock')),
    materials TEXT,
    technique TEXT,
    origin VARCHAR(255),
    dimensions JSONB,
    weight DECIMAL(10, 2),
    min_order_quantity INTEGER DEFAULT 1 CHECK (min_order_quantity >= 1),
    inventory INTEGER DEFAULT 0 CHECK (inventory >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attributes JSONB NOT NULL,
    price_adjustment DECIMAL(10, 2) DEFAULT 0,
    inventory INTEGER NOT NULL DEFAULT 0 CHECK (inventory >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video')),
    is_thumbnail BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## ▶️ Step 4: Run the Server

Create Upload Folders: The application saves product media and profile pictures locally for development.

```bash
# Creates the necessary folders
mkdir -p uploads/products
mkdir -p <YOUR_DOWNLOADS_FOLDER>/artisan_profile_pictures
```

Start the Server:

```bash
node server.js
```

The console should confirm: `Server running on port 5000.`

---

## 🔑 Initial Testing & Authorization

All Artisan-specific routes are protected by JWT authentication and role-based authorization (artisan role).
### Swagger UI Usage
I have implemented the SWAGGER UI for which you can go to:

http://localhost:5000/api-docs

### Testing Sequence

1. **Register an Artisan:** Use `POST /api/auth/register` with `user_type: "artisan"`.
2. **Bypass KYC (For Development):** After registration, the account is `pending_kyc` and cannot log in. Manually update the database:

```sql
UPDATE users SET status = 'active' WHERE email = '<REGISTERED_ARTISAN_EMAIL>';
UPDATE artisans SET kyc_status = 'verified' WHERE id = (SELECT id FROM users WHERE email = '<REGISTERED_ARTISAN_EMAIL>');
```

3. **Login:** Use `POST /api/auth/login` to get your `accessToken`.
4. **Test Product Endpoints:** Use the `accessToken` in the header as `Authorization: Bearer <token>`.

### Example Endpoint (Product Creation)

**Method:** `POST`  
**URL:** `http://localhost:5000/api/products/products`  
**Headers:** `Authorization: Bearer <Token>`, `Content-Type: application/json`  

**Body (JSON):**

```json
{
    "name": "Ceramic Tea Set",
    "description": "Hand-glazed ceramic tea set for two.",
    "category_id": "a4d33457-4148-477d-810a-3c1264c7606e",
    "price": 65.00,
    "materials": "Porcelain clay",
    "technique": "Wheel-thrown",
    "origin": "Chennai, India",
    "inventory": 10
}
```

"""Build the bundled synthetic retail database. All prices and totals are in USD."""
import calendar
import random
import sqlite3
from pathlib import Path

rng = random.Random(31415)
path = Path(__file__).resolve().parents[1] / 'dist' / 'retail.sqlite'
db = sqlite3.connect(':memory:')
db.executescript("""
PRAGMA foreign_keys = ON;
CREATE TABLE customers (customer_id INTEGER PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL);
CREATE TABLE products (product_id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL);
CREATE TABLE orders (order_id INTEGER PRIMARY KEY, order_date TEXT NOT NULL, customer_id INTEGER NOT NULL REFERENCES customers, total REAL NOT NULL);
CREATE TABLE order_items (order_id INTEGER NOT NULL REFERENCES orders, product_id INTEGER NOT NULL REFERENCES products, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, PRIMARY KEY(order_id, product_id));
""")
first = 'Avery Maya Leo Zoe Isha Luca Noah Priya Iris Theo Aria Omar Nora Hana Miles Riya Finn Alex Neil Sana'.split()
last = 'Chen Shah Kim Reed Adams Patel Lane Sato Park Cruz Singh Ford Das Roy Ali Bell'.split()
regions = ['West', 'East', 'North', 'South']
for i in range(160):
    db.execute('INSERT INTO customers VALUES (?, ?, ?)', (i+1, first[i%20]+' '+last[i//20], regions[i%4]))
catalog = [
    ('Studio Headphones','Electronics',89),('Wireless Keyboard','Electronics',65),('Portable Speaker','Electronics',49),
    ('USB-C Hub','Electronics',42),('Desk Lamp','Home',59),('Ceramic Mug','Home',18),('Linen Throw','Home',69),('Glass Carafe','Home',36),
    ('Canvas Tote','Accessories',29),('Travel Backpack','Accessories',79),('Leather Wallet','Accessories',45),('Laptop Sleeve','Accessories',39),
    ('Dot Grid Notebook','Stationery',16),('Desk Planner','Stationery',24),('Gel Pen Set','Stationery',12),('Sketchbook','Stationery',22)]
db.executemany('INSERT INTO products VALUES (?, ?, ?, ?)', [(i+1,*p) for i,p in enumerate(catalog)])
order_id = 1000
for month, volume in enumerate([120,165,149,205,188,255,231,199,225,264,281,315], 1):
    for _ in range(volume):
        order_id += 1
        day = rng.randint(1, calendar.monthrange(2025, month)[1])
        items = [(order_id, p+1, rng.choices([1,2,3],[7,2,1])[0], catalog[p][2]) for p in rng.sample(range(len(catalog)), rng.choices([1,2,3],[3,5,2])[0])]
        db.execute('INSERT INTO orders VALUES (?, ?, ?, ?)', (order_id, f'2025-{month:02}-{day:02}',rng.randint(1,160), sum(x[2]*x[3] for x in items)))
        db.executemany('INSERT INTO order_items VALUES (?, ?, ?, ?)', items)
db.commit()
with sqlite3.connect(path) as target:
    db.backup(target)
print(db.execute('SELECT COUNT(*),SUM(total) FROM orders').fetchone())

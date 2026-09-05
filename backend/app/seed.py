"""Seed the database with Strobrie's real menu, events, and POS reference data.

Run with: python -m app.seed
"""

from datetime import datetime, timezone

from . import models, pos_models, shop_models
from .database import Base, SessionLocal, engine

# Strobrie's real menu — one shared catalog for both the till (Flow's Sell
# screen) and the online shop. Prices are in whole Naira. All items are
# seeded as available online (is_active=True); toggle per item from Flow's
# Products tab if some shouldn't be orderable online.
#
# Transcribed from Strobrie's actual printed menus (Coffee, Drinks, Breakfast,
# Lunch, Bakery, Whole Cakes, and the final Bar Menu — the earlier
# Cocktails/Mocktails template images and the older, lower-priced Drinks Menu
# were superseded drafts and are not included). Items sold in multiple sizes
# or quantities (cake sizes, box counts, pancake stacks, cocktail flavours)
# are each their own product, since they're each independently priced and
# orderable.
PRODUCTS = [
    # --- Coffee ---
    ("esp", "Coffee", "Espresso", 3800),
    ("ame", "Coffee", "Americano", 4700),
    ("affo", "Coffee", "Affogato", 6100),
    ("cap", "Coffee", "Cappuccino", 5300),
    ("flw", "Coffee", "Flat White", 5700),
    ("lat", "Coffee", "Cafe Latte", 5700),
    ("moc", "Coffee", "Cafe Mocha", 6600),
    ("crm", "Coffee", "Caramel Macchiato", 6600),
    ("hzl", "Coffee", "Hazelnut Latte", 6600),
    ("ica", "Coffee", "Iced Americano", 4800),
    ("dgw", "Coffee", "Dalgona Whipped Coffee", 5900),
    ("ila", "Coffee", "Iced Cafe Latte", 6600),
    ("icm", "Coffee", "Iced Cafe Mocha", 7200),
    ("icc", "Coffee", "Iced Caramel Macchiato", 7200),
    ("ibsl", "Coffee", "Iced Brown Sugar Latte", 7200),
    ("ihl", "Coffee", "Iced Hazelnut Latte", 7600),
    ("ilb", "Coffee", "Iced Lotus Biscoff Latte", 7600),
    ("mcb", "Coffee", "Maple Cream Brew", 5500),
    ("span", "Coffee", "Spanish Latte", 5800),
    ("orl", "Coffee", "Oreo Latte", 6200),
    ("iccc", "Coffee", "Ice Blended Cookies and Cream", 6500),
    ("ibcar", "Coffee", "Ice Blended Caramel", 7500),
    ("chl", "Coffee", "Chai Latte", 5700),
    ("chocl", "Coffee", "Chocolate Latte", 7200),
    ("matl", "Coffee", "Matcha Latte", 7200),
    ("strm", "Coffee", "Strawberry Matcha (Seasonal)", 7500),
    ("mgm", "Coffee", "Mango Matcha (Seasonal)", 7400),
    # --- Extras (coffee add-ons) ---
    ("soymilk", "Extras", "Soy Milk (add-on)", 1500),
    ("whipcr", "Extras", "Whipped Cream (add-on)", 1500),
    ("honeyad", "Extras", "Honey (add-on)", 800),
    ("wmilkad", "Extras", "Whole Milk (add-on)", 500),
    # --- Tea ---
    ("tbag", "Tea", "Tea Bag Selection", 3900),
    ("hglt", "Tea", "Honey Ginger Lemon Tea", 4500),
    ("bit", "Tea", "Iced Tea – Berry", 5300),
    ("lit", "Tea", "Iced Tea – Lemon", 4700),
    ("spit", "Tea", "Iced Tea – Sweet Peach", 5500),
    ("gait", "Tea", "Iced Tea – Green Apple", 5500),
    ("bsmt", "Tea", "Brown Sugar Milk Tea", 5700),
    ("mpft", "Tea", "Mango Passion Fruit Tea", 5500),
    # --- Juices ---
    ("apj", "Juices", "Apple Juice", 4700),
    ("crj", "Juices", "Cranberry Juice", 5300),
    ("cij", "Juices", "Citrus Juice", 5300),
    ("grj", "Juices", "Grape Juice", 4700),
    ("foj", "Juices", "Fresh Orange Juice", 5700),
    ("fpj", "Juices", "Fresh Pineapple Juice", 5700),
    ("fwj", "Juices", "Fresh Watermelon Juice", 5700),
    # --- Smoothies ---
    ("acb", "Smoothies", "Acai Berry Smoothie", 7000),
    ("trs", "Smoothies", "Tropical Smoothie (Seasonal)", 6500),
    ("grs", "Smoothies", "Green Smoothie", 6500),
    # --- Milkshakes ---
    ("vms", "Milkshakes", "Milkshake – Vanilla", 6600),
    ("bnm", "Milkshakes", "Milkshake – Banana", 7200),
    ("orm", "Milkshakes", "Milkshake – Oreo", 7600),
    ("lbm", "Milkshakes", "Milkshake – Lotus Biscoff", 7400),
    ("cfm", "Milkshakes", "Milkshake – Coffee", 7600),
    ("brm", "Milkshakes", "Milkshake – Brownie", 7200),
    ("ptm", "Milkshakes", "Milkshake – Pistachio", 8000),
    ("swm", "Milkshakes", "Milkshake – Strawberry", 7000),
    ("cpm", "Milkshakes", "Milkshake – Caramel Popcorn", 7500),
    # --- Lemonades ---
    ("frl", "Lemonades", "Lemonade – Fresh", 5100),
    ("spl", "Lemonades", "Lemonade – Sparkling", 4800),
    ("orgl", "Lemonades", "Lemonade – Orange", 5800),
    ("blul", "Lemonades", "Lemonade – Blueberry", 6600),
    ("pfl", "Lemonades", "Lemonade – Passion Fruit", 6600),
    ("sbl", "Lemonades", "Lemonade – Strawberry Basil", 5800),
    ("cpfl", "Lemonades", "Lemonade – Cucumber Passion Fruit", 5800),
    ("mml", "Lemonades", "Lemonade – Mango Mint (Seasonal)", 5800),
    ("lycl", "Lemonades", "Lemonade – Lychee", 5500),
    ("cherl", "Lemonades", "Lemonade – Cherry (Alc)", 6500),
    # --- Breakfast ---
    ("bph", "Breakfast", "Butter Pancakes (Half Stack)", 8500),
    ("bpf", "Breakfast", "Butter Pancakes (Full Stack)", 10500),
    ("cph", "Breakfast", "Chocolate Pancakes (Half Stack)", 8800),
    ("cpf", "Breakfast", "Chocolate Pancakes (Full Stack)", 10200),
    ("blph", "Breakfast", "Blueberry Pancakes (Half Stack)", 8500),
    ("blpf", "Breakfast", "Blueberry Pancakes (Full Stack)", 10600),
    ("ccph", "Breakfast", "Chocolate Chip Pancakes (Half Stack)", 9000),
    ("ccpf", "Breakfast", "Chocolate Chip Pancakes (Full Stack)", 11600),
    ("nph", "Breakfast", "Nutella Pancakes (Half Stack)", 9200),
    ("npf", "Breakfast", "Nutella Pancakes (Full Stack)", 11800),
    ("fth", "Breakfast", "French Toast (Half)", 8500),
    ("ftf", "Breakfast", "French Toast (Full)", 10000),
    ("vbth", "Breakfast", "Very Berry Toast (Half)", 9500),
    ("vbtf", "Breakfast", "Very Berry Toast (Full)", 10500),
    ("nfth", "Breakfast", "Nutella French Toast (Half)", 9700),
    ("nftf", "Breakfast", "Nutella French Toast (Full)", 10900),
    ("eggb", "Breakfast", "Eggs Breakfast (Scrambled/Fried/Poached/Sunny Side Up)", 6200),
    ("omc", "Breakfast", "Omelette With Cheese", 7600),
    ("omm", "Breakfast", "Omelette With Mushroom", 8000),
    ("omcm", "Breakfast", "Omelette With Cheese & Mushroom", 9500),
    ("savb", "Breakfast", "Savoury Breakfast", 11500),
    ("engb", "Breakfast", "English Breakfast", 15000),
    ("thsand", "Breakfast", "Sandwich – Turkey Ham", 10500),
    ("chsand", "Breakfast", "Sandwich – Chicken", 11000),
    ("tcsand", "Breakfast", "Sandwich – Tomato Cheese", 10500),
    ("bltsand", "Breakfast", "Sandwich – BLT", 10500),
    ("bmuf", "Breakfast", "Breakfast Muffin", 10500),
    ("bburg", "Breakfast", "Breakfast Burger", 12000),
    ("xegg", "Breakfast", "Extra Eggs [2]", 3100),
    ("xcs", "Breakfast", "Extra Chicken Sausage [2]", 3500),
    ("xbs", "Breakfast", "Extra Beef Sausage [2]", 5000),
    ("xth", "Breakfast", "Extra Turkey Ham [2]", 3500),
    ("xbac", "Breakfast", "Extra Bacon [2]", 3500),
    ("xmush", "Breakfast", "Extra Mushrooms", 3200),
    ("xfries", "Breakfast", "Extra French Fries", 5200),
    ("xspfries", "Breakfast", "Extra Sweet Potato Fries", 3200),
    ("xciab", "Breakfast", "Extra Ciabatta Toast [2]", 3000),
    # --- Lunch ---
    ("bbqs", "Lunch", "BBQ Torzo Sandwich", 11000),
    ("cmays", "Lunch", "Chicken Mayo Sandwich", 10500),
    ("gbgc", "Lunch", "Ground Beef Grilled Cheese", 11500),
    ("cbu", "Lunch", "Chicken Burger", 10500),
    ("bbn", "Lunch", "Beef Burger", 10500),
    ("hmcb", "Lunch", "Honey Mustard Chicken Burger", 11000),
    ("suy", "Lunch", "Suya Yakitori", 11500),
    ("vwr", "Lunch", "Vegetarian Wrap", 10500),
    ("hmw", "Lunch", "Honey Mustard Wrap", 11000),
    ("rag", "Lunch", "Ragu Pasta", 12000),
    ("ccp", "Lunch", "Creamy Chicken Penne", 13500),
    # --- Brunch (weekend-only: Saturdays 9am-1pm, Sundays 10am-3pm) ---
    ("brpb", "Brunch", "Pancakes – Butter", 10500),
    ("brpbl", "Brunch", "Pancakes – Blueberry", 10600),
    ("brpc", "Brunch", "Pancakes – Chocolate", 10200),
    ("brpn", "Brunch", "Pancakes – Nutella", 11800),
    ("brpcc", "Brunch", "Pancakes – Chocolate Chip", 11600),
    ("brftp", "Brunch", "French Toast – Plain", 10000),
    ("brftn", "Brunch", "French Toast – Nutella", 10900),
    ("brftvb", "Brunch", "French Toast – Very Berry", 10500),
    ("brwb", "Brunch", "Waffles – Butter", 9700),
    ("brwcs", "Brunch", "Waffles – With Chicken Strips", 12600),
    ("brcbn", "Brunch", "Crepes – Banana Nutella", 9700),
    ("brcbc", "Brunch", "Crepes – Berry Cream Cheese", 10600),
    ("brccm", "Brunch", "Crepes – Chicken Mushroom", 11600),
    ("brrag", "Brunch", "Ragu Pasta", 12000),
    ("bravo", "Brunch", "Avocado Toast", 11200),
    ("breb", "Brunch", "Eggs Benedict", 9300),
    ("breng", "Brunch", "English Breakfast", 15000),
    ("brsc", "Brunch", "Sandwich – Chicken", 11000),
    ("brsgc", "Brunch", "Sandwich – Grilled Cheese", 10500),
    ("breggs", "Brunch", "Eggs (choice of Pancakes, Waffles, or French Toast)", 6200),
    ("brkid", "Brunch", "Kiddie Breakfast", 7500),
    ("brkcr", "Brunch", "Kids Crepes (3pc, Banana Nutella)", 6200),
    ("brkcs", "Brunch", "Kids Chicken Strips & Fries", 7300),
    ("brxegg", "Brunch", "Extra Eggs [2]", 3100),
    ("brxfries", "Brunch", "Extra French Fries", 5200),
    ("brxbs", "Brunch", "Extra Beef Sausages [2]", 5000),
    ("brxcs", "Brunch", "Extra Chicken Sausages [2]", 3500),
    ("brxcst", "Brunch", "Extra Chicken Strips", 5000),
    ("brxwc", "Brunch", "Extra Whipped Cream", 1500),
    ("brxbh", "Brunch", "Extra Bacon/Ham [2]", 3500),
    ("brvom", "Brunch", "Virgin Orange Mimosa", 6700),
    ("brvsm", "Brunch", "Virgin Sunrise Mimosa", 6700),
    ("brmk", "Brunch", "Mermaids Kiss", 6100),
    ("brgls", "Brunch", "Ginger Lemon Spritz", 6100),
    ("brom", "Brunch", "Orange Mimosas", 6700),
    ("brbl", "Brunch", "Blueberry Lemosas", 7700),
    ("brsm", "Brunch", "Sunrise Mimosas", 7700),
    ("brrp", "Brunch", "Strobrie Rum Punch", 7000),
    ("brwl", "Brunch", "Whiskey Lemonade", 7100),
    ("brpff", "Brunch", "Passion Fruit Fizz", 7000),
    # --- Bakery ---
    ("cup1", "Bakery", "Cupcake (Single)", 2800),
    ("cup4", "Bakery", "Cupcake (Box of 4)", 10500),
    ("cup6", "Bakery", "Cupcake (Box of 6)", 15000),
    ("cup8", "Bakery", "Cupcake (Box of 8)", 20000),
    ("cup12", "Bakery", "Cupcake (Box of 12)", 30000),
    ("cup24", "Bakery", "Cupcake (Box of 24)", 60000),
    ("lcs", "Bakery", "Cake Slice – Lemon", 4800),
    ("bcs", "Bakery", "Cake Slice – Banana", 4500),
    ("ccs", "Bakery", "Cake Slice – Carrot", 4800),
    ("rvs", "Bakery", "Cake Slice – Red Velvet", 4800),
    ("mcs", "Bakery", "Cake Slice – Milk Chocolate", 5000),
    ("cncs", "Bakery", "Cake Slice – Cookies and Cream", 5000),
    ("minc", "Bakery", "Mini Cake – Carrot", 6800),
    ("minr", "Bakery", "Mini Cake – Red Velvet", 6300),
    ("minch", "Bakery", "Mini Cake – Chocolate (Milk/Dark)", 7000),
    ("mincc", "Bakery", "Mini Cake – Cookies and Cream", 7000),
    ("ctlb", "Bakery", "Cake Tub – Lotus Biscoff", 8600),
    ("ctvb", "Bakery", "Cake Tub – Very Berry Vanilla", 8600),
    ("ctde", "Bakery", "Cake Tub – Dark Choco Espresso", 8300),
    ("cthc", "Bakery", "Cake Tub – Hazelnut Crunch", 9000),
    ("ctcc", "Bakery", "Cake Tub – Coconut Cream Trifle", 8200),
    ("mcny", "Bakery", "Mini Cheesecake – New York Style", 7500),
    ("mcbl", "Bakery", "Mini Cheesecake – Blueberry", 7800),
    ("mcst", "Bakery", "Mini Cheesecake – Strawberries", 7800),
    ("mcor", "Bakery", "Mini Cheesecake – Oreo", 7400),
    ("mcmg", "Bakery", "Mini Cheesecake – Mango (Seasonal)", 7500),
    ("mclb", "Bakery", "Mini Cheesecake – Lotus Biscoff", 7800),
    ("lfl", "Bakery", "Cake Loaf – Lemon", 14200),
    ("lfb", "Bakery", "Cake Loaf – Banana", 14200),
    ("lfc", "Bakery", "Cake Loaf – Chocolate (Milk/Dark)", 16600),
    ("lfcc", "Bakery", "Cake Loaf – Cookies and Cream", 16600),
    ("lfr", "Bakery", "Cake Loaf – Red Velvet", 14000),
    ("lfcar", "Bakery", "Cake Loaf – Carrot", 15800),
    ("muf1", "Bakery", "Muffin (Single)", 3500),
    ("muf4", "Bakery", "Muffin (Box of 4)", 14000),
    ("muf6", "Bakery", "Muffin (Box of 6)", 20000),
    ("muf12", "Bakery", "Muffin (Box of 12)", 40000),
    ("bwc1", "Bakery", "Brownie – Chocolate (Single)", 2800),
    ("bwc4", "Bakery", "Brownie – Chocolate (Box of 4)", 10500),
    ("bwo1", "Bakery", "Brownie – Oreo (Single)", 3600),
    ("bwo4", "Bakery", "Brownie – Oreo (Box of 4)", 11500),
    ("bwr1", "Bakery", "Brownie – Red Velvet (Single)", 3800),
    ("bwr4", "Bakery", "Brownie – Red Velvet (Box of 4)", 12000),
    ("ckpc", "Bakery", "Pistachio Cranberry Cookie", 3800),
    ("ckcc", "Bakery", "Chocolate Chip Cookie", 1800),
    ("ckmc", "Bakery", "Marshmallow Crunch Cookie", 1800),
    ("ckoa", "Bakery", "Oatmeal Cookie", 4000),
    ("ckcp", "Bakery", "Chocolate Pecan Cookie", 4500),
    ("ckcr", "Bakery", "Crinkle Cookie (Lemon/RedVelvet/Chocolate)", 3500),
    ("brstp1", "Bakery", "Sticky Toffee Pecan Roll (Single)", 3200),
    ("brstp4", "Bakery", "Sticky Toffee Pecan Roll (Box of 4)", 11200),
    ("brcin1", "Bakery", "Cinnamon Roll (Single)", 2500),
    ("brcin4", "Bakery", "Cinnamon Roll (Box of 4)", 9000),
    # --- Cakes (whole, by size — multiple flavours/layers cost extra, ask in store) ---
    ("wcv4", "Cakes", 'Whole Cake – Vanilla (4")', 26500),
    ("wcv6", "Cakes", 'Whole Cake – Vanilla (6")', 37100),
    ("wcv8", "Cakes", 'Whole Cake – Vanilla (8")', 46400),
    ("wcv10", "Cakes", 'Whole Cake – Vanilla (10")', 60300),
    ("wcv12", "Cakes", 'Whole Cake – Vanilla (12")', 79000),
    ("wcv14", "Cakes", 'Whole Cake – Vanilla (14")', 92500),
    ("wcb4", "Cakes", 'Whole Cake – Banana (4")', 29900),
    ("wcb6", "Cakes", 'Whole Cake – Banana (6")', 41900),
    ("wcb8", "Cakes", 'Whole Cake – Banana (8")', 50500),
    ("wcb10", "Cakes", 'Whole Cake – Banana (10")', 65000),
    ("wcb12", "Cakes", 'Whole Cake – Banana (12")', 83900),
    ("wcb14", "Cakes", 'Whole Cake – Banana (14")', 102700),
    ("wcr4", "Cakes", 'Whole Cake – Red Velvet (4")', 31000),
    ("wcr6", "Cakes", 'Whole Cake – Red Velvet (6")', 46400),
    ("wcr8", "Cakes", 'Whole Cake – Red Velvet (8")', 55500),
    ("wcr10", "Cakes", 'Whole Cake – Red Velvet (10")', 66500),
    ("wcr12", "Cakes", 'Whole Cake – Red Velvet (12")', 87000),
    ("wcr14", "Cakes", 'Whole Cake – Red Velvet (14")', 106000),
    ("wcc4", "Cakes", 'Whole Cake – Chocolate (4")', 33000),
    ("wcc6", "Cakes", 'Whole Cake – Chocolate (6")', 46400),
    ("wcc8", "Cakes", 'Whole Cake – Chocolate (8")', 55500),
    ("wcc10", "Cakes", 'Whole Cake – Chocolate (10")', 69500),
    ("wcc12", "Cakes", 'Whole Cake – Chocolate (12")', 88400),
    ("wcc14", "Cakes", 'Whole Cake – Chocolate (14")', 107000),
    ("wca4", "Cakes", 'Whole Cake – Carrot (4")', 33000),
    ("wca6", "Cakes", 'Whole Cake – Carrot (6")', 46000),
    ("wca8", "Cakes", 'Whole Cake – Carrot (8")', 55500),
    ("wca10", "Cakes", 'Whole Cake – Carrot (10")', 70500),
    ("wca12", "Cakes", 'Whole Cake – Carrot (12")', 91500),
    ("wca14", "Cakes", 'Whole Cake – Carrot (14")', 108000),
    ("wcl4", "Cakes", 'Whole Cake – Lemon (4")', 31000),
    ("wcl6", "Cakes", 'Whole Cake – Lemon (6")', 45000),
    ("wcl8", "Cakes", 'Whole Cake – Lemon (8")', 55500),
    ("wcl10", "Cakes", 'Whole Cake – Lemon (10")', 70500),
    ("wcl12", "Cakes", 'Whole Cake – Lemon (12")', 89000),
    ("wcl14", "Cakes", 'Whole Cake – Lemon (14")', 108000),
    ("wco4", "Cakes", 'Whole Cake – Cookies & Cream (4")', 33000),
    ("wco6", "Cakes", 'Whole Cake – Cookies & Cream (6")', 46400),
    ("wco8", "Cakes", 'Whole Cake – Cookies & Cream (8")', 58000),
    ("wco10", "Cakes", 'Whole Cake – Cookies & Cream (10")', 70000),
    ("wco12", "Cakes", 'Whole Cake – Cookies & Cream (12")', 88000),
    ("wco14", "Cakes", 'Whole Cake – Cookies & Cream (14")', 107000),
    ("wcs4", "Cakes", 'Whole Cake – Strawberry (4", Seasonal)', 31500),
    ("wcs6", "Cakes", 'Whole Cake – Strawberry (6", Seasonal)', 41500),
    ("wcs8", "Cakes", 'Whole Cake – Strawberry (8", Seasonal)', 53500),
    ("wcs10", "Cakes", 'Whole Cake – Strawberry (10", Seasonal)', 67500),
    ("wcs12", "Cakes", 'Whole Cake – Strawberry (12", Seasonal)', 85400),
    ("wcs14", "Cakes", 'Whole Cake – Strawberry (14", Seasonal)', 104000),
    # --- Cheesecakes (by size) ---
    ("chny6", "Cheesecakes", 'Cheesecake – New York Style (6")', 46400),
    ("chny8", "Cheesecakes", 'Cheesecake – New York Style (8")', 58800),
    ("chny10", "Cheesecakes", 'Cheesecake – New York Style (10")', 75000),
    ("chst6", "Cheesecakes", 'Cheesecake – Strawberry (6", Seasonal)', 53500),
    ("chst8", "Cheesecakes", 'Cheesecake – Strawberry (8", Seasonal)', 66000),
    ("chst10", "Cheesecakes", 'Cheesecake – Strawberry (10", Seasonal)', 82000),
    ("chbl6", "Cheesecakes", 'Cheesecake – Blueberry (6")', 56200),
    ("chbl8", "Cheesecakes", 'Cheesecake – Blueberry (8")', 67800),
    ("chbl10", "Cheesecakes", 'Cheesecake – Blueberry (10")', 83500),
    ("chmg6", "Cheesecakes", 'Cheesecake – Mango (6", Seasonal)', 51500),
    ("chmg8", "Cheesecakes", 'Cheesecake – Mango (8", Seasonal)', 67500),
    ("chmg10", "Cheesecakes", 'Cheesecake – Mango (10", Seasonal)', 83500),
    ("cholb6", "Cheesecakes", 'Cheesecake – Oreo/Lotus Biscoff (6")', 53500),
    ("cholb8", "Cheesecakes", 'Cheesecake – Oreo/Lotus Biscoff (8")', 66000),
    ("cholb10", "Cheesecakes", 'Cheesecake – Oreo/Lotus Biscoff (10")', 82000),
    # --- Mocktails ---
    ("vmoj", "Mocktails", "Virgin Mojito", 5800),
    ("vmojbl", "Mocktails", "Virgin Mojito – Blueberry", 5800),
    ("vmojsb", "Mocktails", "Virgin Mojito – Strawberry Basil", 5800),
    ("vmojpf", "Mocktails", "Virgin Mojito – Passion Fruit", 6100),
    ("glsp", "Mocktails", "Ginger-Lemon Spritz", 6100),
    ("bbas", "Mocktails", "Berry Basil", 6800),
    ("pgb", "Mocktails", "Pineapple Ginger Beer", 5800),
    ("rsf", "Mocktails", "Raspberry Soda Float", 6800),
    ("svp", "Mocktails", "Strobrie Virgin Punch", 6000),
    ("spklyc", "Mocktails", "Sparkling Lychee", 6500),
    # --- Cocktails ---
    ("moj", "Cocktails", "Mojito", 6100),
    ("mojbl", "Cocktails", "Mojito – Blueberry", 6800),
    ("mojsb", "Cocktails", "Mojito – Strawberry Basil", 6800),
    ("mojpf", "Cocktails", "Mojito – Passion Fruit", 7000),
    ("wsour", "Cocktails", "Whiskey Sour", 7100),
    ("gnt", "Cocktails", "Gin and Tonic", 6100),
    ("gntbl", "Cocktails", "Gin and Tonic – Blueberry", 6900),
    ("gntsb", "Cocktails", "Gin and Tonic – Strawberry Basil", 6900),
    ("gntpf", "Cocktails", "Gin and Tonic – Passion Fruit", 6900),
    ("lycsun", "Cocktails", "Lychee Sunburst", 7500),
    ("pld", "Cocktails", "Pink Lemon Drop", 6500),
    ("apfz", "Cocktails", "Apricot Fizz", 6500),
    ("aptini", "Cocktails", "Appletini", 7500),
    ("sbsmash", "Cocktails", "Strawberry Basil Smash", 7500),
    ("srp", "Cocktails", "Strobrie Rum Punch", 7000),
    ("pff", "Cocktails", "Passion Fruit Fizz", 7000),
    ("amsour", "Cocktails", "Amaretto Sour", 7500),
    # --- Schweppes (mixers) ---
    ("sodaw", "Schweppes", "Soda Water", 1800),
    ("tonicw", "Schweppes", "Tonic Water", 1800),
    ("vmojmix", "Schweppes", "Virgin Mojito Mix", 1800),
    ("bitlem", "Schweppes", "Bitter Lemon", 1800),
    ("pineschw", "Schweppes", "Pineapple", 1800),
    ("gbeerschw", "Schweppes", "Ginger Beer", 1800),
    ("chapman", "Schweppes", "Chapman", 1800),
    # --- Beer ---
    ("hnk", "Beer", "Heineken", 2000),
    ("dsp", "Beer", "Desperados", 2200),
]

EVENTS = [
    dict(
        title="Karaoke Night",
        description="Grab the mic and join us for a night of karaoke, drinks, and good vibes.",
        start_time=datetime(2026, 9, 5, 17, 0, tzinfo=timezone.utc),
        capacity=40,
    ),
    dict(
        title="Sip & Paint",
        description="Drinks, canvases, and good company — no experience needed.",
        start_time=datetime(2026, 9, 12, 16, 0, tzinfo=timezone.utc),
        capacity=20,
    ),
    dict(
        title="Pottery Workshop",
        description="Hands-on pottery session for all skill levels.",
        start_time=datetime(2026, 9, 19, 15, 0, tzinfo=timezone.utc),
        capacity=12,
    ),
]

# Ingredients tracked in the POS inventory, with starting stock levels.
INGREDIENTS = [
    ("coffeebeans", "Coffee beans", "kg", 5),
    ("milk", "Whole milk", "l", 20),
    ("cream", "Cream", "l", 10),
    ("sugar", "Sugar", "kg", 10),
    ("flour", "Flour", "kg", 15),
    ("eggs", "Eggs", "each", 120),
    ("butter", "Butter", "kg", 8),
    ("nutella", "Nutella", "kg", 5),
    ("chocolate", "Chocolate", "kg", 6),
    ("chicken", "Chicken breast", "kg", 15),
    ("beef", "Beef", "kg", 12),
    ("bacon", "Bacon", "kg", 6),
    ("turkeyham", "Turkey ham", "kg", 6),
    ("ciabatta", "Ciabatta bread", "each", 40),
    ("lettuce", "Lettuce", "kg", 5),
    ("tomatoes", "Tomatoes", "kg", 8),
    ("cheese", "Cheese", "kg", 6),
    ("bananas", "Bananas", "kg", 10),
    ("strawberries", "Strawberries", "kg", 6),
    ("blueberries", "Blueberries", "kg", 4),
    ("pasta", "Pasta", "kg", 10),
    ("oranges", "Fresh oranges", "kg", 15),
    ("lemons", "Lemons", "kg", 15),
    ("honey", "Honey", "l", 6),
    ("yogurt", "Yogurt", "l", 8),
    ("coconutmilk", "Coconut milk", "l", 6),
]

# Illustrative starter recipes for Coffee & Drinks — the rest can be defined
# from the Inventory tab in Flow.
RECIPES = {
    "esp": [("coffeebeans", 0.018)],
    "ame": [("coffeebeans", 0.018)],
    "cap": [("coffeebeans", 0.018), ("milk", 0.15)],
    "lat": [("coffeebeans", 0.018), ("milk", 0.2)],
    "moc": [("coffeebeans", 0.018), ("milk", 0.15), ("chocolate", 0.02)],
    "crm": [("coffeebeans", 0.018), ("milk", 0.2)],
    "ica": [("coffeebeans", 0.018)],
    "ila": [("coffeebeans", 0.018), ("milk", 0.2)],
    "span": [("coffeebeans", 0.018), ("milk", 0.2), ("cream", 0.03)],
    "frl": [("lemons", 0.15), ("sugar", 0.03)],
    "foj": [("oranges", 0.35)],
    "lit": [("lemons", 0.08), ("sugar", 0.02)],
    "vms": [("milk", 0.25), ("cream", 0.05)],
    "swm": [("milk", 0.2), ("strawberries", 0.12)],
    "acb": [("blueberries", 0.1), ("yogurt", 0.1), ("coconutmilk", 0.05)],
}


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(shop_models.Product).count() == 0:
            for i, (slug, category, name, price) in enumerate(PRODUCTS):
                db.add(shop_models.Product(slug=slug, category=category, name=name, price=price, sort_order=i))
            print(f"Inserted {len(PRODUCTS)} products")
        else:
            print("Products already seeded, skipping")

        if db.query(models.Event).count() == 0:
            db.add_all(models.Event(**event) for event in EVENTS)
            print(f"Inserted {len(EVENTS)} events")
        else:
            print("Events already seeded, skipping")

        if db.query(pos_models.InventoryItem).count() == 0:
            for slug, name, unit, qty in INGREDIENTS:
                db.add(pos_models.InventoryItem(slug=slug, name=name, unit=unit, quantity=qty))
            print(f"Inserted {len(INGREDIENTS)} inventory items")
        else:
            print("Inventory already seeded, skipping")
        db.commit()

        if db.query(pos_models.Recipe).count() == 0:
            product_by_slug = {p.slug: p for p in db.query(shop_models.Product).all()}
            ingredient_by_slug = {i.slug: i for i in db.query(pos_models.InventoryItem).all()}
            count = 0
            for item_slug, ingredients in RECIPES.items():
                product = product_by_slug.get(item_slug)
                if not product:
                    continue
                for ing_slug, qty in ingredients:
                    ingredient = ingredient_by_slug.get(ing_slug)
                    if not ingredient:
                        continue
                    db.add(
                        pos_models.Recipe(
                            menu_item_id=product.id, ingredient_id=ingredient.id, qty_per_item=qty
                        )
                    )
                    count += 1
            print(f"Inserted {count} recipe ingredient links")
        else:
            print("Recipes already seeded, skipping")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()

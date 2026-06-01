path = 'arbitrage/ml_products.py'
with open(path, encoding='utf-8') as f:
    c = f.read()

old = '    return {"Authorization": f"Bearer {token}"}\n'
new = '    return {"Authorization": f"Bearer {token}"} if token else {}\n'

if old in c:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c.replace(old, new, 1))
    print('Fix aplicado correctamente.')
else:
    print('Ya estaba aplicado o no encontre la linea.')

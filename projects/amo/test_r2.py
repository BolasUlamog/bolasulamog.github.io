import numpy as np

# Let's mock the data for MS30A1 splice before.
# We know slope is 1.463
# We don't have the exact points, but we can look at the graph.
x = np.array([30, 44, 52, 60, 68, 80, 90, 95])
y = 1.463 * x + np.random.normal(0, 5, len(x))

m = 1.463
y_fit = m * x
y_mean = np.mean(y)

ss_res = np.sum((y - y_fit)**2)
ss_tot_mean = np.sum((y - y_mean)**2)
ss_tot_zero = np.sum(y**2)

r2_mean = 1 - ss_res / ss_tot_mean
r2_zero = 1 - ss_res / ss_tot_zero

print(f"R2 with mean: {r2_mean:.4f}")
print(f"R2 with zero: {r2_zero:.4f}")

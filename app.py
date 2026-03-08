import random
import time
import numpy as np
from flask import Flask, jsonify
from flask_cors import CORS
from sklearn.linear_model import LinearRegression

app = Flask(__name__)
CORS(app)

# --- Global Simulated State ---
time_step = 0
historical_data = {
    "cpu": [],
    "gpu": [],
    "memory": [],
    "power": []
}

chaos_mode_cycles = 0

# --- Workload Prediction Model ---
prediction_model = LinearRegression()

def simulate_metrics():
    global time_step, chaos_mode_cycles
    # Simulate a dynamic workload that has peaks and troughs
    base_load = 40 + 30 * np.sin(time_step / 10.0) 
    noise = random.uniform(-10, 10)
    
    if chaos_mode_cycles > 0:
        base_load = 100 # Pin it to the max
        chaos_mode_cycles -= 1
    
    cpu_usage = max(5, min(100, base_load + noise + random.uniform(-5, 5)))
    gpu_usage = max(0, min(100, base_load * 1.2 + noise + random.uniform(-10, 10)))
    memory_usage = max(20, min(100, 50 + 20 * np.sin(time_step / 15.0) + noise))
    power_watts = 200 + (cpu_usage * 1.5) + (gpu_usage * 3.0) + (memory_usage * 0.5)

    historical_data["cpu"].append(cpu_usage)
    historical_data["gpu"].append(gpu_usage)
    historical_data["memory"].append(memory_usage)
    historical_data["power"].append(power_watts)
    
    # Keep only last 100 for training
    for k in historical_data.keys():
        if len(historical_data[k]) > 100:
            historical_data[k].pop(0)

    time_step += 1
    return {
        "cpu": round(cpu_usage, 2),
        "gpu": round(gpu_usage, 2),
        "memory": round(memory_usage, 2),
        "power": round(power_watts, 2),
        "timestamp": time_step
    }

def train_and_predict():
    if len(historical_data["cpu"]) < 10:
        return {"predicted_cpu": historical_data["cpu"][-1] if historical_data["cpu"] else 0, 
                "predicted_gpu": historical_data["gpu"][-1] if historical_data["gpu"] else 0}
    
    # Train a quick linear model on recent CPU/GPU data to predict the next point
    data = np.array(historical_data["cpu"])
    X = np.arange(len(data)).reshape(-1, 1)
    y = data
    prediction_model.fit(X, y)
    next_x = np.array([[len(data)]])
    pred_cpu = prediction_model.predict(next_x)[0]
    
    data_gpu = np.array(historical_data["gpu"])
    prediction_model.fit(X, data_gpu)
    pred_gpu = prediction_model.predict(next_x)[0]
    
    return {
        "predicted_cpu": round(max(0, min(100, pred_cpu)), 2),
        "predicted_gpu": round(max(0, min(100, pred_gpu)), 2)
    }

def dynamic_resource_scheduler(current_metrics, predicted):
    # Determine server adjustments
    servers_active = 10
    if predicted["predicted_cpu"] > 75 or predicted["predicted_gpu"] > 75:
        servers_active = 15
        status = "Scaling Up (High Demand)"
        action = "Provisioned additional GPU nodes."
    elif predicted["predicted_cpu"] < 35 and predicted["predicted_gpu"] < 35:
        servers_active = 5
        status = "Scaling Down (Low Demand)"
        action = "Powered down idle server units."
    else:
        status = "Optimal Allocation"
        action = "Maintained current cluster state."

    return {
        "servers_active": servers_active,
        "status": status,
        "action_taken": action
    }

def model_selection(current_gpu):
    # Choose AI models based on current GPU load
    if current_gpu > 80:
        return {"model": "MobileNetV3 (Pruned)", "reason": "High GPU load detected. Selected lightweight model for energy efficiency.", "energy_saved": "45%"}
    elif current_gpu > 50:
        return {"model": "EfficientNet-B0", "reason": "Moderate GPU load. Balanced model selected.", "energy_saved": "25%"}
    else:
        return {"model": "ResNet-50", "reason": "Low GPU load. Maximum accuracy model selected, no optimization needed.", "energy_saved": "0%"}

@app.route('/api/system_status', methods=['GET'])
def get_system_status():
    current_metrics = simulate_metrics()
    predicted = train_and_predict()
    scheduler = dynamic_resource_scheduler(current_metrics, predicted)
    model_sel = model_selection(current_metrics["gpu"])
    
    return jsonify({
        "monitoring": current_metrics,
        "prediction": predicted,
        "scheduler": scheduler,
        "model_selection": model_sel,
        "carbon_footprint_reduction": round(random.uniform(15, 30), 2)
    })

@app.route('/api/chaos_spike', methods=['POST'])
def trigger_chaos():
    global chaos_mode_cycles
    chaos_mode_cycles = 8 # Force high load for next 8 simulation cycles (16 seconds)
    return jsonify({"status": "Chaos spike injected! Workload peaking.", "cycles": 8})

if __name__ == '__main__':
    app.run(port=5000, debug=True)

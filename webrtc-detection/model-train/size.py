import onnx

# Load your ONNX model
model_path = "model-train/yolov8n.onnx"  # change filename if needed
model = onnx.load(model_path)

# Print input and output details
print("== Model Inputs ==")
for inp in model.graph.input:
    dims = [d.dim_value if d.dim_value > 0 else "?" for d in inp.type.tensor_type.shape.dim]
    print(f"Name: {inp.name}, Shape: {dims}")

print("\n== Model Outputs ==")
for out in model.graph.output:
    dims = [d.dim_value if d.dim_value > 0 else "?" for d in out.type.tensor_type.shape.dim]
    print(f"Name: {out.name}, Shape: {dims}")

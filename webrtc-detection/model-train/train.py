from onnxruntime.quantization import quantize_dynamic, QuantType

model_fp32 = "model-train/yolov8n.onnx"
model_int8 = "model-train/yolov8n-int8.onnx"

# Dynamic quantization (weights -> int8, activations stay float32)
quantize_dynamic(
    model_fp32,
    model_int8,
    weight_type=QuantType.QInt8  # or QuantType.QUInt8
)

print(f"Quantized model saved to: {model_int8}")

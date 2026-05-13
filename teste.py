# Challenge
# Inside the editor, complete the following steps:
# Create a dictionary called car with the keys "brand", "model", "year" and values "Ford", "Mustang", 2024
# Print the value of the "model" key
# Add a new key "color" with the value "red"
# Remove the "brand" key using pop()
# Print the dictionary

car = {
    "brand": "Ford",
    "model": "Mustang",
    "year": 2024
}

print(car["model"])
car["color"] = "red"
car.pop("brand")
print(car)


# thisdict = {
#   "brand": ["Ford", "Chevrolet", "Dodge"],
#   "model": "Mustang",
#   "year": {"pre-war": 1964, 
#            "post-war": 2020}
# }

# thisdict["color"] = "red"
# thisdict.pop("model")

# print(thisdict.fromkeys(["brand", "model", "year"], "hi"))

# for key, value in thisdict.items():
#     if key == "year":
#         for subkey, subvalue in value.items():
#             print(f"{subkey}: {subvalue}")
#     else:
#         print(f"{key}: {value}")

# for x in thisdict:
#     if x == "year":
#         for subkey, subvalue in thisdict[x].items():
#             print(f"{subkey}: {subvalue}")
#     else:
#         print(f"{x}: {thisdict[x]}")

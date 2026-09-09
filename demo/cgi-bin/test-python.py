import os

query = os.environ.get('QUERY_STRING', '')
method = os.environ.get('REQUEST_METHOD', 'GET')

print("Content-Type: text/plain")
print("X-Runtime: python-process")
print()
print(f"Executed inside Python process. Method: {method}, Query: {query}")

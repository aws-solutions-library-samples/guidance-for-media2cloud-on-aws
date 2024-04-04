import sys
from app import lambda_handler

files = sys.argv[1]

event = {
  "local_file": files
}

context = {}

if __name__ == "__main__":
    response = lambda_handler(event, context)
    print('response', response)

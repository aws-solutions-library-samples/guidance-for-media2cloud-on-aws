import sys
from app import lambda_handler

event = {}
context = {}

if __name__ == "__main__":
    response = lambda_handler(event, context)
    print('response', response)

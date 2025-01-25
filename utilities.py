from datetime import datetime, timedelta, time
import json
import jsonpickle
import random
import string

# function for determining if a time is between two times
def is_time_between(begin_time, end_time, check_time=None):
    # If check time is not given, default to current UTC time
    check_time = check_time or datetime.now().time()
    if begin_time < end_time:
        return check_time >= begin_time and check_time <= end_time
    else: # crosses midnight
        return check_time >= begin_time or check_time <= end_time
    
def getSerializedData(data):
    return json.loads(jsonpickle.encode(data))

def getExpFromLevel(level = 1):
    return round((level * 10) ** 1.1)

def getID(num = 16):
    return ''.join(random.choice(string.ascii_letters) for x in range(num)) 
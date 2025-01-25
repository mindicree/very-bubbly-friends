from sqlalchemy import Column, Integer, String, DATETIME, JSON, ForeignKey, Table, create_engine, MetaData
from sqlalchemy.orm import relationship, backref, Session
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()
engine = create_engine("sqlite:///data.db")

def formatDate(date: datetime):
    return date.strftime("%Y-%m-%d %H:%M:%S")

def getNow():
    return datetime.now()

def getNowString():
    return formatDate(getNow())

'''
Below is an example of a namy to many relationship
between users and a stateable game object possible
to be owned by many players
'''

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    created_at = Column(DATETIME, default=datetime.now)
    updated_at = Column(DATETIME, default=datetime.now, onupdate=func.now())
    name = Column(String)

    objects = relationship("Object", secondary="user_object", viewonly=True)
    
class Object(Base):
    __tablename__ = "objects"

    id = Column(Integer, primary_key=True)
    created_at = Column(DATETIME, default=datetime.now)
    updated_at = Column(DATETIME, default=datetime.now, onupdate=func.now())

    users = relationship("User", secondary="user_object", viewonly=True)

class UserObject(Base):
    __tablename__ = "user_object"

    id = Column(Integer, primary_key=True)
    created_at = Column(DATETIME, default=datetime.now)
    updated_at = Column(DATETIME, default=datetime.now, onupdate=func.now())

    user_id = Column(Integer, ForeignKey("users.id"))
    object_id = Column(Integer, ForeignKey("objects.id"))

    user = relationship("User", backref=backref("user_object", cascade="all, delete-orphan"))
    object = relationship("Object", backref=backref("user_object", cascade="all, delete-orphan"))
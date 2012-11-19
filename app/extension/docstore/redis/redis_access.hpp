#ifndef REDIS_ACCESS_HPP
#define REDIS_ACCESS_HPP

#include <jsobjects.hpp>

class RedisAccess;
class RedisList;

// Note: using raw pointers when generating JS binding
#ifdef SWIG
typedef RedisAccess* RedisAccessPtr;
typedef RedisList* RedisListPtr;
#else
#include <boost/shared_ptr.hpp>
typedef boost::shared_ptr<RedisAccess> RedisAccessPtr;
typedef boost::shared_ptr<RedisList> RedisListPtr;
#endif


class RedisAccess {
  
public:  
  static RedisAccess* Create();
  
  virtual void setHost(const char* host) = 0;

  virtual void setPort(int port) = 0;

  virtual void setScope(const char* scope) = 0;
  
  virtual void connect() = 0;
  
  virtual void disconnect() = 0;

  virtual bool exists(const std::string &id) = 0;

  virtual std::string get(const std::string &id) = 0;

  virtual void set(const std::string &id, const std::string &val) = 0;
  
  // delete is C++ keyword so this needs to be renamed for JS
  virtual void remove(const std::string &prefix) = 0;
  
  virtual void beginTransaction() = 0;
  
  virtual JSArrayPtr executeTransaction() = 0;

  virtual void cancelTransaction() = 0;

  virtual RedisListPtr asList(const std::string &id) = 0;

};

class RedisList {

public:
  virtual unsigned int size() = 0;
  
  virtual void add(std::string val) = 0;
  
  virtual std::string getLast() = 0;
  
  virtual JSArrayPtr asArray() = 0;
};

#endif // REDIS_ACCESS_HPP

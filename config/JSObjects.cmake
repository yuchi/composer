set(DOWNLOAD_DIR ${EXTERNALS_DIR}/jsobjects)

if (NOT JSOBJECTS_INCLUDED AND DOWNLOAD_EXTERNALS)
  set (JSOBJECTS_INCLUDED ON CACHE INTERNAL "" FORCE)

  ExternalProject_Add(jsobjects
    GIT_REPOSITORY git://github.com/oliver----/jsobjects.git
    PREFIX ${DOWNLOAD_DIR}
    DOWNLOAD_DIR ${DOWNLOAD_DIR}
    STAMP_DIR ${DOWNLOAD_DIR}/stamp
    SOURCE_DIR ${DOWNLOAD_DIR}/jsobjects
    BINARY_DIR ${DOWNLOAD_DIR}/bin
    UPDATE_COMMAND git pull origin master # skip update
    CONFIGURE_COMMAND ${CMAKE_COMMAND} -DIMPORT=ON
        -DENABLE_JSC=ON -DENABLE_CPP=ON -DENABLE_TESTS=OFF
        -DEXTERNALS_DIR=${EXTERNALS_DIR}
        -DLIBRARY_TYPE=STATIC
        ${DOWNLOAD_DIR}/jsobjects
    BUILD_COMMAND make
    INSTALL_COMMAND "" # skip install
  )

endif ()

set(jsobjects_INCLUDE_DIRS ${DOWNLOAD_DIR}/jsobjects/include)
set(jsobjects_LIBRARY_DIRS)
set(jsobjects_SWIG_INCLUDE_DIRS ${DOWNLOAD_DIR}/jsobjects/swig)

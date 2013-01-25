// Replicator

Substance.Replicator = function(params) {
  this.store = params.store;
  this.user = params.user; // Current user scope

  var that = this;

  // Util
  function extractCommits(doc, start, end) {
    var skip = false;
    
    if (start === end) return [];
    var commit = doc.commits[start];

    if (!commit) return [];
    commit.sha = start;

    var commits = [commit];
    var prev = commit;

    while (!skip && (commit = doc.commits[commit.parent])) {
      if (end && commit.sha === end) {
        skip = true;
      } else {
        commit.sha = prev.parent;
        commits.push(commit);
        prev = commit;
      }
    }
    return commits.reverse();
  }


  // Start sync
  // -----------------

  this.sync = function(cb) {
  	this.computeJobs(function(err, jobs) {
      console.log('JOBS', jobs);
  		var index = 0;

  		function next() {
  			if (index === jobs.length) return cb(null);
  			that.processDocument(jobs[index], function(err) {
          if (err) console.log('ERROR WHILE PROCSSING JOB', jobs[index], "ERROR", err);
  				index += 1;
  				next();
  			});
  		}

  		next(); // start processing the first doc
  	});
  };

  // Process a single doc sync job
  // -----------------

  this.processDocument = function(doc, cb) {
    if (doc.action === "create") return that.create(doc, cb);
    if (doc.action === "push") return that.push(doc, cb);
    if (doc.action === "pull") return that.pull(doc, cb);
    if (doc.action === "fetch") return that.fetch(doc, cb);
  };

  // Fetch doc from remote store
  // -----------------
  // 
  // TODO: create dedicated fetch method on server, returning commits in a sequence
  // so we don't have to use extractCommits

  this.fetch = function(doc, cb) {
    console.log('fetching ', doc.id, ' from server');
    _.request("GET", Substance.settings.hub + '/documents/get/'+that.user+'/'+doc.id, {}, function(err, doc) {

      console.log('THE DOC, just fetched', doc);
      // var commits = store.commits(doc.id, doc.refs.tail);
      var commits = extractCommits(doc, doc.refs.tail);
      console.log('commits to be applied locally', commits);

      // 1. create doc locally
      store.create(doc.id, function(err) {
        if (err) return cb(err);
        // 2. send commits
        console.log('storing commits');
        store.update(doc.id, commits, function(err) {
          console.log('updated local doc. ERRORS?', err);
          if (err) return cb(err);
          
          // TODO: Update meta accordingly.
          console.log('updating local metadata from server', doc.meta);

          store.updateMeta(doc.id, doc.meta, function(err) {
            store.setRef(doc.id, 'tail-remote', doc.refs.tail);
            store.setRef(doc.id, 'tail-master', doc.refs.master);
            // In case there are some undone commits
            store.setRef(doc.id, 'master', doc.refs.master);

            cb(err);
          });
        });
      });
    });
  };


  // Pull
  // -----------------
  // 
  // TODO: Fetch metadata on pull and update locally / this overwrites pending local commits

  this.pull = function(doc, cb) {
    // Get latest synced commit
    var tailRemote = store.getRef(doc.id, 'tail-remote');
    console.log('pulling in changes... for', tailRemote);

    _.request("GET", Substance.settings.hub + '/documents/commits/'+that.user+'/'+doc.id+'/'+tailRemote, {}, function(err, data) {
      console.log('what does remote say?', data);
      console.log('remote commits', data.commits);
      // Should also give me remote refs
      // data.commits |data.refs
      if (data.commits.length > 0) {
        store.update(doc.id, data.commits, function(err) {
          console.log('applied remote commits.. Any ERRORS?', err);

          // Update references
          store.setRef(doc.id, 'master', data.refs.master);
          store.setRef(doc.id, 'tail', data.refs.tail); // now done implicitly by update

          // Tail and master are now up to date. Now set 'tail-remote' to new tail
          store.setRef(doc.id, 'tail-remote', data.refs.tail);
          store.setRef(doc.id, 'master-remote', data.refs.master);

          // Update metadata (remote version)
          store.updateMeta(doc.id, data.meta);
          cb(null);
        });
      } else {
        // Update metadata (remote version)
        store.updateMeta(doc.id, data.meta);
        cb(null);
      }
    });
  };


  // Push
  // -----------------

  this.push = function(doc, cb) {
    store.get(doc.id, function(err, doc) {
      var remoteTail = store.getRef(doc.id, 'tail-remote');  
      var localTail = store.getRef(doc.id, 'tail');

      // Find all commits after synced (remote) commit
      var commits = store.commits(doc.id, localTail, remoteTail);

      console.log('LE LOCAL COMMITTES to be pushed: ', commits);

      var data = {
        username: that.user, 
        id: doc.id,
        commits: commits, // may be empty
        meta: doc.meta,
        refs: doc.refs // make sure refs are updated on the server (for now master, tail is updated implicitly)
      };

      _.request("POST", Substance.settings.hub + '/documents/update', data, function (err) {
        // Set synced reference accordingly
        if (err) return cb(err);
        store.setRef(doc.id, 'tail-remote', doc.refs.tail);
        store.setRef(doc.id, 'master-remote', doc.refs.master);

        cb(null);
      });
    });
  };

  // Sync doc with remote store (bi-directional)
  // -----------------

  // this.update = function(doc, cb) {
  //   that.pull(doc, function(err, fastForward) {
  //     // For now only fast forward sync works smoothly
  //     // In case ther are local changes, they are lost (not pushed! what ever is on the server wins)
  //     if (fastForward) {
  //       that.push(doc, cb);
  //       console.log('pull successfull. no changes.. fast forwarding..');  
  //     } else {
  //       console.log('pull with changes ignoring local changes');
  //       cb(null); // done
  //     }
  //   });
  // };

  // Create doc on the server
  // -----------------

  this.create = function(doc, cb) {
    console.log('creating ', doc.id, ' on the server');

    // 1. Get doc from local docstore
    store.get(doc.id, function(err, doc) {
      // extract commits
      var commits = store.commits(doc.id, doc.refs.tail);
      console.log("COMMITS OF NEW DOC", commits);
      // 2. Create empty doc on the server
      _.request("POST", Substance.settings.hub + '/documents/create', {"username": that.user, id: doc.id}, function (err) {
        console.log('created on the server..');
        if (err) return cb(err);
        // 3. Send updates to server
        _.request("POST", Substance.settings.hub + '/documents/update', {"username": that.user, id: doc.id, commits: commits, meta: doc.meta}, function (err) {
          store.setRef(doc.id, 'tail-remote', doc.refs.tail);
          store.setRef(doc.id, 'master-remote', doc.refs.master);
          cb(err);
        });
      });
    });
  };


  // Compute jobs for dirty documents
  // -----------------

  this.computeJobs = function(cb) {
  	// Status object looks like this
    var jobs = [];
    that.localDocStates(function(err, localDocs) {
      _.request("GET", Substance.settings.hub + '/documents/status/'+that.user, {}, function (err, remoteDocs) {
        console.log('diff', localDocs, remoteDocs);

        _.each(localDocs, function(doc, id) {
          var remoteDoc = remoteDocs[id];
          // New unsynced doc?
          if (!remoteDoc) {
            jobs.push({id: id, action: "create"});
            return;
          }

          // Local refs
          var masterRemote = store.getRef(id, 'master-remote');
          var tailRemote = store.getRef(id, 'tail-remote');

          if (tailRemote !== remoteDoc.refs['tail'] || masterRemote !== remoteDoc.refs['master']) {
            jobs.push({id: id, action: "pull"});
            return;
          } else if (tailRemote !== doc.refs['tail'] || doc.refs['master'] !== masterRemote) {
            // Local changes only -> Push (fast-forward)
            jobs.push({id: id, action: "push"});
            return;
          }
        });

        _.each(remoteDocs, function(remoteDoc, id) {
          var doc = localDocs[id];

          // New remote doc? -> Fetch
          if (!doc) {
            jobs.push({id: id, action: "fetch"});
            return;
          }
        });

        cb(null, jobs);
      });
    });
  };


  // Ask for status of all local documents
  // -----------------
  // 
  // Returns: A hash of document status objects

  this.localDocStates = function(cb) {
    store.list(function(err, localDocs) {
      var result = {};
      _.each(localDocs, function(doc) {
        result[doc.id] = doc;
        delete result[doc.id].id;
      });
      cb(null, result);
    });
  };

};
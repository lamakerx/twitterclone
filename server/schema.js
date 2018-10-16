const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLID,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean
} = require('graphql');
const { GraphQLUpload } = require('apollo-server');

const mimeprocessor = require('mime-types');
const fs = require('fs');

const User = require('./models/user');
const Tweet = require('./models/tweet');
const Comment = require('./models/comment');

const hostname = require('./hostname');

const UserType = new GraphQLObjectType({ // name, login, password, image, subscribers
  name: "User",
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    url: { type: GraphQLString },
    login: { type: GraphQLString },
    password: { type: GraphQLString },
    image: { type: GraphQLString },
    subscribedTo: {
      type: new GraphQLList(UserType),
      async resolve({ id }) {
        let a = await User.findById(id); // user subscribed to ...
        return User.find({
          _id: {
            $in: a.subscribedTo
          }
        });
      }
    },
    tweets: {
      type: new GraphQLList(TweetType),
      resolve: ({ id }) => Tweet.find({ creatorID: id })
    }
  })
});

const CommentType = new GraphQLObjectType({
  name: "Comment",
  fields: () => ({
    id: { type: GraphQLID },
    creatorID: { type: GraphQLID },
    sendedToID: { type: GraphQLID },
    content: { type: GraphQLString },
    time: { type: GraphQLString },
    likes: {
      type: new GraphQLList(UserType),
      async resolve({ id }) {
        let a = await Comment.findById(id);
        return User.find({
          _id: {
            $in: a.likes
          }
        });
      }
    },
    likesInt: {
      type: GraphQLInt,
      async resolve({ id }) {
        let a = await Comment.findById(id);
        if(!a) return 0;

        let b = await User.find({
          _id: {
            $in: a.likes
          }
        });
        return b.length;
      }
    },
    creator: {
      type: UserType,
      resolve: ({ creatorID }) => User.findById(creatorID)
    },
    sendedTo: {
      type: TweetType,
      resolve: ({ sendedToID }) => Tweet.findById(sendedToID)
    }
  })
})

const TweetType = new GraphQLObjectType({
  name: "Tweet",
  fields: () => ({
    id: { type: GraphQLID },
    creatorID: { type: GraphQLID },
    time: { type: GraphQLString },
    content: { type: GraphQLString },
    isLiked: { type: GraphQLBoolean },
    isSubscribedToCreator: { type: GraphQLBoolean },
    likes: {
      type: new GraphQLList(UserType),
      async resolve({ id }) {
        let a = await Tweet.findById(id);
        return User.find({
          _id: {
            $in: a.likes
          }
        });
      }
    },
    likesInt: {
      type: GraphQLInt,
      async resolve({ id }) {
        let a = await Tweet.findById(id);
        if(!a) return 0;

        let b = await User.find({
          _id: {
            $in: a.likes
          }
        });
        return b.length;
      }
    },
    comments: {
      type: new GraphQLList(CommentType),
      resolve: ({ id }) => Comment.find({ sendedToID: id })
    },
    commentsInt: {
      type: GraphQLInt,
      async resolve({ id }) {
        let a = await Comment.find({ sendedToID: id });
        return a.length;
      }
    },
    creator: {
      type: UserType,
      resolve: ({ creatorID }) => User.findById(creatorID)
    }
  })
});

const RootQuery = new GraphQLObjectType({
  name: "RootQuery",
  fields: {
    users: {
      type: new GraphQLList(UserType),
      resolve: () => User.find({})
    },
    user: {
      type: UserType,
      args: {
        id: { type: GraphQLID },
        login: { type: GraphQLString },
        password: { type: GraphQLString },
        targetID: { type: GraphQLID }
      },
      async resolve(_, { id: _id, login, password, targetID }) {
        let a = await User.findOne({ _id, login, password }),
            b = await User.findById(targetID ? targetID : _id);

        return (a && b) ? b : null
      }
    },
    login: {
      type: UserType,
      args: {
        login: { type: GraphQLString },
        password: { type: GraphQLString }
      },
      resolve: (_, { login, password }) => User.findOne({ login, password })
    },
    tweets: {
      type: new GraphQLList(TweetType),
      resolve: () => Tweet.find({})
    },
    tweet: {
      type: TweetType,
      args: {
        id: { type: GraphQLID },
        login: { type: GraphQLString },
        password: { type: GraphQLString },
        targetID: { type: GraphQLID }
      },
      async resolve(_, { id: _id, login, password, targetID }) {
        let user = await User.findOne({ _id, login, password }),
            tweet = await Tweet.findById(targetID);

        tweet.isSubscribedToCreator = user.subscribedTo.find(io => io.toString() === tweet.creatorID) ? true:false;

        if(user && tweet) {
          return tweet;
        } else {
          return null;
        }
      }
    },
    comments: {
      type: new GraphQLList(CommentType),
      resolve: () => Comment.find({})
    },
    comment: {
      type: CommentType,
      args: {
        id: { type: GraphQLID }
      },
      resolve: (_, { id }) => Comment.findById(id)
    },
    fetchFeed: {
      type: new GraphQLList(TweetType),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) }
      },
      async resolve(_, { id: _id, login, password, materialLikes }) {
        let user = await User.findOne({ _id, login, password });
        if(!user) return null;

        let a = await Tweet.find({
          creatorID: {
            $in: user.subscribedTo
          }
        }).sort({ time: -1 }); // XXX - XXX

        a.forEach(io => io.isLiked = io.likes.find(ic => ic.toString() === user._id.toString()) ? true:false);

        return a;
      }
    }
  }
});

const RootMutation = new GraphQLObjectType({
  name: "RootMutation",
  fields: {
    registerUser: {
      type: UserType,
      args: {
        name: { type: new GraphQLNonNull(GraphQLString) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        image: { type: new GraphQLNonNull(GraphQLUpload) },
        url: { type: new GraphQLNonNull(GraphQLString) }
      },
      async resolve(_, { name, login, password, image, url }) {
        function gen() {
          let a = "",
              b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
              c = () => Math.floor(Math.random() * b.length);
          for(let ma = 0; ma < 225; ma++) a += b[c()];

          return a;
        }

        if(await User.findOne({ $or: [
          { url },
          { login }
        ] })) {
          return null;
        }

        const { stream, mimetype } = await image;
        const imagePath = `/files/avatars/${ gen() }.${ mimeprocessor.extension(mimetype) }`;
        stream.pipe(fs.createWriteStream('.' + imagePath));

        let a = await new User({
          name, login, password, url,
          image: hostname + imagePath
        }).save();

        await a.updateOne({
          subscribedTo: [a._id]
        });

        return a;
      }
    },
    subscribeUser: {
      type: GraphQLBoolean,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        targetID: { type: new GraphQLNonNull(GraphQLID) }
      },
      async resolve(_, { id: _id, login, password, targetID }) {
        let mainUser = await User.findOne({ _id, login, password }),
            targetUser = await User.findById(targetID);
        if(mainUser && targetUser && mainUser._id !== targetUser._id) {
          let subscribed = await User.findOne({
            _id: mainUser._id,
            subscribedTo: {
              $in: [targetUser._id.toString()]
            }
          });

          if(!subscribed) { // subscribe
            await User.findOneAndUpdate({ _id: mainUser._id }, {
              $push: { subscribedTo: targetID }
            });
            return true;
          } else { // unsubscribe
            await User.findOneAndUpdate({ _id: mainUser._id }, {
              $pull: { subscribedTo: targetID }
            });
            return false;
          }
        } else {
          return false;
        }
      }
    },
    addTweet: {
      type: TweetType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        content: { type: new GraphQLNonNull(GraphQLString) }
      },
      async resolve(_, { id: _id, login, password, content }) {
        let user = await User.findOne({ _id, login, password });
        if(user) {
          let a = new Tweet({
            content,
            creatorID: user.id,
            time: new Date()
          }).save();

          // ...pubsub...

          return a;
        } else {
          return null;
        }
      }
    },
    commentTweet: {
      type: GraphQLBoolean,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        targetID: { type: new GraphQLNonNull(GraphQLID) },
        content: { type: new GraphQLNonNull(GraphQLString) }
      },
      async resolve(_, { id: _id, login, password, targetID, content }) {
        let user = await User.findOne({ _id, login, password }),
            tweet = await Tweet.findById(targetID);

        if(user && tweet) {
          let model = new Comment({
            content,
            sendedToID: tweet.id,
            creatorID: user.id,
            time: new Date()
          }).save();

          // ...pubsub...

          return model;
        } else {
          return null;
        }
      }
    },
    likeTweet: {
      type: GraphQLBoolean,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        targetID: { type: new GraphQLNonNull(GraphQLID) }
      },
      async resolve(_, { id: _id, login, password, targetID }) {
        let user = await User.findOne({ _id, login, password }),
            tweet = await Tweet.findById(targetID);

        if(user && tweet) {
          let str = st => st.toString();
          let isLiked = tweet.likes.find(io => str(io) === str(user._id)) ? true:false;
          if(!isLiked) {
            await Tweet.findOneAndUpdate({ _id: tweet.id }, {
              $push: { likes: user._id }
            });
            return true;
          } else {
            await Tweet.findOneAndUpdate({ _id: tweet.id }, {
              $pull: { likes: user._id }
            });
            return false;
          }
        } else {
          return false;
        }
      }
    },
    likeComment: {
      type: GraphQLBoolean,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        targetID: { type: new GraphQLNonNull(GraphQLID) }
      },
      async resolve(_, { id: _id, login, password, targetID }) {
        let user = await User.findOne({ _id, login, password }),
            comment = await Comment.findById(targetID);

        if(user && comment) {
          let str = st => st.toString();
          let isLiked = comment.likes.find(io => str(io) === str(user._id)) ? true:false;
          if(!isLiked) {
            await Comment.findOneAndUpdate({ _id: comment.id }, {
              $push: { likes: user._id }
            });
            return true;
          } else {
            await Comment.findOneAndUpdate({ _id: comment.id }, {
              $pull: { likes: user._id }
            });
            return false;
          }
        }
      }
    }
  }
});

module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: RootMutation
});
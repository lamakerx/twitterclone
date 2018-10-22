// NOTE: All those validations (...User.findOne({...})...) can be optimized by using try/catch statement

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

function gen() {
  let a = "",
      b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      c = () => Math.floor(Math.random() * b.length);
  for(let ma = 0; ma < 225; ma++) a += b[c()];

  return a;
}

const UserType = new GraphQLObjectType({
  name: "User",
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    url: { type: GraphQLString },
    login: { type: GraphQLString },
    password: { type: GraphQLString },
    image: { type: GraphQLString },
    profileBackground: { type: GraphQLString },
    profileDescription: { type: GraphQLString },
    location: { type: GraphQLString },
    joinedDate: { type: GraphQLString },
    isVertificated: { type: GraphQLBoolean },
    requesterIsSubscriber: {
      type: GraphQLBoolean,
      args: {
        id: { type: GraphQLID },
        login: { type: GraphQLString },
        password: { type: GraphQLString }
      },
      async resolve({ id }, { id: _id, login, password }) { // XXX
        let a = await User.findOne({
          _id,
          login,
          password,
          subscribedTo: {
            $in: [id]
          }
        });

        return a ? true:false;
      }
    },
    subscribedTo: {
      type: new GraphQLList(UserType),
      resolve({ subscribedTo }) {
        return User.find({
          _id: {
            $in: subscribedTo
          }
        });
      }
    },
    subscribers: {
      type: new GraphQLList(UserType),
      resolve({ id }) {
        return User.find({
          subscribedTo: {
            $in: [id]
          }
        });
      }
    },
    subscribedToInt: {
      type: GraphQLInt,
      async resolve({ subscribedTo }) {
        return subscribedTo.length;
      }
    },
    subscribersInt: {
      type: GraphQLInt,
      async resolve({ id }) {
        let a = await User.find({
          subscribedTo: {
            $in: [id]
          }
        });

        return a.length;
      }
    },
    tweets: {
      type: new GraphQLList(TweetType),
      resolve: ({ id }) => Tweet.find({ creatorID: id }).sort({ time: -1 })
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
    isLiked: {
      type: GraphQLBoolean,
      args: {
        id: { type: GraphQLID },
        login: { type: GraphQLString },
        password: { type: GraphQLString }
      },
      async resolve(parent, args) {
        let user = await User.findOne({ _id: args.id, login: args.login, password: args.password });
        if(user) {
          return parent.likes.find(io => io.toString() === user._id.toString()) ? true:false;
        } else {
          return null;
        }
      }
    },
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
    isLiked: {
      type: GraphQLBoolean,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) }
      },
      async resolve(parent, args) {
        return parent.likes.find(io => io.toString() === args.id.toString()) ? true:false;
      }
    },
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
      resolve: ({ id }) => Comment.find({ sendedToID: id }).sort({ time: -1 })
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
        targetID: { type: GraphQLID },
        targetUrl: { type: GraphQLString }
      },
      async resolve(_, { id: _id, login, password, targetID, targetUrl }) {
        let a = await User.findOne({ _id, login, password }); // requester

        // if(targetUrl) {
        //   b = await User.findOne({ url: targetUrl }); // result
        // } else if(targetID || _id) {
        //   b = await User.findById(targetID || _id); // result
        // } else {
        //   return null;
        // }
        let b = await User[targetUrl ? "findOne" : "findById"](targetUrl ? { url: targetUrl } : (targetID || _id));

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
            tweet = await Tweet.findById(targetID),
            str = str1 => str1.toString();

        tweet.isLiked = tweet.likes.find(io => str(io) === str(user._id)) ? true:false;
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
            $in: [...user.subscribedTo, _id]
          }
        }).sort({ time: -1 }); // XXX - XXX

        a.forEach(io => io.isLiked = io.likes.find(ic => ic.toString() === user._id.toString()) ? true:false);

        return a;
      }
    },
    searchTweets: {
      type: new GraphQLList(TweetType),
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        request: { type: new GraphQLNonNull(GraphQLString) }
      },
      async resolve(_, { id: _id, login, password, request: req }) {
        let user = await User.findOne({ _id, login, password });

        if(user) {
          return Tweet.find({
            // $or: [

            // ]
            content: {
              $in: [(new RegExp(req, "i"))]
            },
            creatorID: {
              $ne: _id
            }
          });
        } else {
          return null;
        }
      }
    },
    searchUsers: {
      type: new GraphQLList(UserType),
      args: {
        id: { type: GraphQLID },
        login: { type: GraphQLString },
        password: { type: GraphQLString },
        request: { type: GraphQLString }
      },
      async resolve(_, { id: _id, login, password, request: req }) {
        let user = await User.findOne({ _id, login, password });

        if(user) {
          return User.find({
            $or: [
              {
                name: {
                  $in: [(new RegExp(req, "i"))]
                }
              },
              {
                url: {
                  $in: [(new RegExp(req, "i"))]
                }
              },
              {
                location: {
                  $in: [(new RegExp(req, "i"))]
                }
              }
            ],
            _id: { // dont search yourself :)
              $ne: _id
            }
          });
        } else {
          return null;
        }
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
          image: "/" + imagePath,
          location: "",
          joinedDate: new Date(),
          subscribedTo: [],
          profileDescription: "",
          profileBackground: ""
        }).save();

        return a;
      }
    },
    updateUserInfo: {
      type: UserType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        name: { type: GraphQLString },
        description: { type: GraphQLString },
        location: { type: GraphQLString },
        image: { type: GraphQLUpload },
        background: { type: GraphQLUpload }
      },
      async resolve(_, { id: _id, login, password, name, description, location, image, background, resetImage, resetBackground }) {
        let user = await User.findOne({ _id, login, password });
        if(user) {
          let deleteImage = false,
              deleteBackground = false;

          // Receive image(avatar)
          let imagePath = "";
          {
            let data = await image;
            deleteImage = data === "DELETE_CURRENT_IMAGE_ACTION_NO_URL_PROVIDED";
            if(data && !resetImage && !deleteImage) {
              imagePath = `/files/avatars/${ gen() }.${ mimeprocessor.extension(data.mimetype) }`;
              data.stream.pipe(fs.createWriteStream('.' + imagePath));
            }
          }


          // Receive background
          let backgroundPath = "";
          {
            let data = await background;
            deleteBackground = data === "DELETE_CURRENT_IMAGE_ACTION_NO_URL_PROVIDED";
            if(data && !resetBackground && !deleteBackground) {
              backgroundPath = `/files/backgrounds/${ gen() }.${ mimeprocessor.extension(data.mimetype) }`;
              data.stream.pipe(fs.createWriteStream('.' + backgroundPath));
            }
          }

          // Update document(user)
          let a = {
            name: name,
            profileDescription: description,
            location: location,
            profileBackground: (backgroundPath && !deleteBackground) ? (backgroundPath) : (deleteBackground) ? "" : user.profileBackground,
            image: (imagePath && !deleteImage) ? (imagePath) : (deleteImage) ? "" : user.image
          }
          await user.updateOne(a);

          // Send response to client
          return a;
        } else {
          return null;
        }
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
        if(_id === targetID) return false;

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
    deleteTweet: {
      type: TweetType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        login: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
        targetID: { type: new GraphQLNonNull(GraphQLID) }
      },
      async resolve(_, { id: _id, login, password, targetID }) {
        let user = await User.find({ _id, login, password });
        let tweet = await Tweet.findById(targetID);

        if(user && tweet) {
          await Comment.remove({
            sendedToID: {
              $in: [targetID]
            }
          });
          return tweet.remove();
        } else {
          return null;
        }
      }
    },
    commentTweet: {
      type: CommentType,
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

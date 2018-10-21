import React from 'react'; import ReactDOM from 'react-dom';
import './index.css';
import './libs/fontawesome';
import registerServiceWorker from './registerServiceWorker';
import cookieControl from './cookieControl';

import Nav from './assets/nav/app';
import Main from './assets/main/app';
import Register from './assets/register/app';
import Tweet from './assets/tweet/app';
import Account from './assets/account/app';
import Followers from './assets/followers/app';
import NFP404 from './assets/nfp404/app';

import { BrowserRouter, Redirect, Switch } from 'react-router-dom';
import { Route } from 'react-router';

import { ApolloProvider } from 'react-apollo';
import apolloClient from './apollo';

// Get URL Path
import links from './links';

const QuaRoute = ({ component: Component, aif, redirect, ...settings }) => (
  <Route
    { ...settings }
    render={ props => {
      if(aif) {
        return <Component { ...props } />
      } else {
        return <Redirect to={ redirect } />
      }
    } }
  />
);

ReactDOM.render(
  <ApolloProvider client={ apolloClient }>
    <BrowserRouter>
      <React.Fragment>
        {
          (cookieControl.get("userdata")) ?
            <Nav />
          : null
        }
        <div id="main">
          <Switch>
          <QuaRoute
              exact
              path={ links["REGISTER_PAGE"] }
              component={ Register }
              aif={ !cookieControl.get("userdata") }
              redirect={ links["MAIN_PAGE"] }
            />
            <QuaRoute
              exact
              path="/"
              component={ Register }
              aif={ cookieControl.get("userdata") }
              redirect={ links["REGISTER_PAGE"] }
            />
            <QuaRoute
              exact
              path={ links["MAIN_PAGE"] }
              component={ Main }
              aif={ cookieControl.get("userdata") }
              redirect={ links["REGISTER_PAGE"] }
            />
            <QuaRoute
              exact
              path={ `${ links["TWEET_PAGE"] }/:id` }
              component={ Tweet }
              aif={ cookieControl.get("userdata") }
              redirect={ links["REGISTER_PAGE"] }
            />
            <QuaRoute
              exact
              path={ `${ links["ACCOUNT_PAGE"] }/:url?` }
              component={ Account }
              aif={ cookieControl.get("userdata") }
              redirect={ links["REGISTER_PAGE"] }
            />
            <QuaRoute
              exact
              path={ `${ links["FOLLOWERS_PAGE"] }/:url/:direct?` }
              component={ Followers }
              aif={ cookieControl.get("userdata") }
              redirect={ links["REGISTER_PAGE"] }
            />
            <QuaRoute
              exact
              path={ `${ links["NOT_FOUND_PAGE"] }/:referral?` }
              component={ NFP404 }
              aif={ cookieControl.get("userdata") }
              redirect={ links["REGISTER_PAGE"] }
            />
            <Redirect to={ links["NOT_FOUND_PAGE"] } />
          </Switch>
        </div>
      </React.Fragment>
    </BrowserRouter>
  </ApolloProvider>, document.getElementById('root'));
registerServiceWorker();

import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FabricDetailPage from './pages/FabricDetailPage';
// ...other imports

const Routes = () => (
  <Router>
    <Switch>
      <Route exact path="/" component={HomePage} />
      <Route path="/fabrics/:fabricId" component={FabricDetailPage} />
      {/* ...other routes */}
    </Switch>
  </Router>
);

export default Routes;

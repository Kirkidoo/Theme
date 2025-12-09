let subscribers = {};

function subscribe(eventName, callback) {
  if (subscribers[eventName] === undefined) {
    subscribers[eventName] = [];
  }

  subscribers[eventName] = [...subscribers[eventName], callback];

  return function unsubscribe() {
    subscribers[eventName] = subscribers[eventName].filter((cb) => {
      return cb !== callback;
    });
  };
}

function publish(eventName, data) {
  if (subscribers[eventName]) {
    subscribers[eventName].forEach((callback) => {
      callback(data);
    });
  }
}

const PUB_SUB_EVENTS = {
  cartUpdate: "cart:update",
  cartItemAdd: "cart:item-add",
  cartError: "cart:error",
  quantityUpdate: "quantity-update",
  productVariantChange: "product:variant-change",
  sectionRefreshed: "section-refreshed",
  compareAdd: "compare:add",
  compareRemove: "compare:remove",
  compareUrlUpdated: "compare:url-updated",
  compareClear: "compare:clear",
};

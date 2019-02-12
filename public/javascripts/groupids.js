if (shareGroups) {
  travelerGlobal.groupids = new Bloodhound({
    datumTokenizer: function(group) {
      return Bloodhound.tokenizers.nonword(group.sAMAccountName);
    },
    queryTokenizer: Bloodhound.tokenizers.nonword,
    identify: function(group) {
      return group.sAMAccountName;
    },
    prefetch: {
      url: prefix
        ? prefix + '/adgroups?term=lab.frib.'
        : '/adgroups?term=lab.frib.',
      cacheKey: 'adgroups',
    },
  });
}

# Models

There are two types of models, those for entities, and others for attachable features of entities.

## Entity models

### form

The forms are the templates on the basis of which the released forms are created. There are two type of forms, normal and discrepancy. The discrepancy forms are only for collection of discrepancy data.

### released form

The released forms are the forms that have been approved for release, and therefore can be used to create travelers. A released form has two components, the base form and an optional discrepancy form. There are three possible combinations of base and discrepancy: base only, discrepancy only, base plus discrepancy. Note that only previously released discrepancy forms can be used to create a base + discrepancy.

### traveler

### binder

### user

## Attachable feature models

## share

## history

## review

An approval model represents the request and the result of a reviewing process. It contains

- policy: all | majority | any
- requested reviewers: admin or manager role required
- review results: approval or not, optional review comments

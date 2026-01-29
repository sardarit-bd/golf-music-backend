import mongoose from 'mongoose';

const stateCitySchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    enum: ['Louisiana', 'Mississippi', 'Alabama', 'Florida']
  },
  
  city: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  
  displayName: {
    type: String,
    required: true
  },
  
  colorPalette: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^#[0-9A-F]{6}$/i.test(v);
      },
      message: props => `${props.value} is not a valid color code!`
    }
  }],
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

stateCitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

stateCitySchema.index({ state: 1, city: 1 }, { unique: true });

const StateCity = mongoose.model('StateCity', stateCitySchema);
export default StateCity;
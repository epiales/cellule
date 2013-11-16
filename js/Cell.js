define( function ( require ) {
	'use strict';

	var _     = require( 'underscore' );
	var THREE = require( 'THREE' );
	var TWEEN = require( 'TWEEN' );


	var viscosity = 1000;
	var colors    = [ 0xEFEFEF, 0xFF6348, 0xF2CB05, 0x49F09F, 0x52B0ED ];
	var min       = 1;
	var max       = 100;
	var minSpeed  = 10;

	var movements = [
		TWEEN.Easing.Linear.None,
		TWEEN.Easing.Quadratic.In,
		TWEEN.Easing.Quadratic.Out,
		TWEEN.Easing.Quadratic.InOut,
		TWEEN.Easing.Quartic.In,
		TWEEN.Easing.Quartic.Out,
		TWEEN.Easing.Quartic.InOut,
		TWEEN.Easing.Quintic.In,
		TWEEN.Easing.Quintic.Out,
		TWEEN.Easing.Quintic.InOut,
		TWEEN.Easing.Cubic.In,
		TWEEN.Easing.Cubic.Out,
		TWEEN.Easing.Cubic.InOut,
		TWEEN.Easing.Exponential.In,
		TWEEN.Easing.Exponential.Out,
		TWEEN.Easing.Exponential.InOut,
		TWEEN.Easing.Circular.In,
		TWEEN.Easing.Circular.Out,
		TWEEN.Easing.Circular.InOut,
		TWEEN.Easing.Back.Out
	];

	var defaults = function () {
		var color    = colors[ Math.floor( Math.random() * colors.length ) ];
		var sight    = Math.round( Math.random() * ( max - min ) + min, 0 );
		var strength = Math.round( Math.random() * ( max - min ) + min, 0 );
		var size     = Math.round( Math.max( 2, Math.min( strength / 10, 5 ) ), 0 );
		var movement = movements[ Math.floor( Math.random() * movements.length ) ];
		var speed    = Math.floor( Math.random() * ( max - minSpeed ) + minSpeed );
		var gender   = Math.random() < 0.5 ? 'male' : 'female';

		return {
			'color'    : color,
			'sight'    : sight,
			'strength' : strength,
			'size'     : size,
			'movement' : movement,
			'speed'    : speed,
			'gender'   : gender,
			'energy'   : 100
		};
	};

	var Cell = function ( options ) {
		options = options || {};
		this.ecosystem = options.ecosystem;

		THREE.Mesh.call( this );

		this.traits = _.extend( defaults(), options.traits );
        this.geometry = this._getGeometry();
        this.material = this._getMaterial();

        this.rotation.y = 0.8;
        this.position = options.position || this._getRandomPoint();
	};

	Cell.prototype = Object.create( THREE.Mesh.prototype );

	Cell.prototype._getMaterial = function () {
		return new THREE.MeshBasicMaterial( { 'color' : this.traits.color } );
	};

	Cell.prototype._getGeometry = function () {

		if ( this.traits.gender === 'female' ) {
			return new THREE.SphereGeometry( this.traits.size, 12, 12 );
		}

		return new THREE.TetrahedronGeometry( this.traits.size * 1.75, 0 );
	};

	Cell.prototype.update = function () {
		this._detectCollisions();
		this._resetColor();
		this._move();
	};

	Cell.prototype._resetColor = function () {
		setTimeout( function () {
			this._setColor( this.traits.color );
		}.bind( this ), 500 );
	};

	Cell.prototype._setColor = function ( color ) {
		this.material.color.set( color );
	};

	Cell.prototype._move = function () {
		if ( !this.target ) {
			this._tween();
		} else if ( this.position.x === this.target.x && this.position.y === this.target.y ) {
			this._tween();
		}

		this._updatePath();
	};

	Cell.prototype._tween = function () {
		this.target = this._getRandomPoint();

		var distance = this.position.distanceTo( this.target );
		var time     = distance / this.traits.speed * viscosity;

		new TWEEN.Tween( this.position ).to( this.target, time )
			.easing( this.traits.movement )
			.start();
	};

	Cell.prototype._addPath = function () {
		var mat = new THREE.LineDashedMaterial( {
			'color'       : this.traits.color,
			'opacity'     : 0.05,
			'transparent' : true
		} );

		this.path = new THREE.Line( new THREE.Geometry(), mat );
		this.parent.add( this.path );
	};

	Cell.prototype._removePath = function () {
		this.parent.remove( this.path );
		this.path = null;
	};

	Cell.prototype._updatePath = function () {
		if ( !this.path ) {
			this._addPath();
		}

		this.path.geometry.vertices = [ this.position, this.target ];
		this.path.geometry.verticesNeedUpdate = true;
	};

	Cell.prototype._getRandomPoint = function () {
		var minX = 0 + this.traits.size + 1;
		var maxX = window.innerWidth - this.traits.size - 1;

		var minY = 0 + this.traits.size + 1;
		var maxY = window.innerHeight - this.traits.size - 1;

		var minZ = 0 + this.traits.size + 1;
		var maxZ = window.innerHeight - this.traits.size - 1;

		var x = Math.floor( Math.random() * ( maxX - minX ) + minX );
		var y = Math.floor( Math.random() * ( maxY - minY ) + minY );
		var z = 0.5 || Math.floor( Math.random() * ( maxZ - minZ ) + minZ );

		return new THREE.Vector3( x, y, z );
	};

	Cell.prototype._detectCollisions = function () {
		var i;

		var position   = this.position;
		var intersects = [];

		// Maximum distance from the origin before we consider collision
		var cells = this.ecosystem.octree.search( position, 5, true );
		if ( cells.length === 1 ) {
			return intersects;
		}

		// For each ray
		for ( i = 0; i < this.ecosystem.rays.length; i += 1 ) {

			// We reset the raycaster to this direction
			this.ecosystem.rayCaster.set( position, this.ecosystem.rays[ i ] );

			// Test if we intersect with any obstacle mesh
			intersects = this.ecosystem.rayCaster.intersectOctreeObjects( cells );

			if ( intersects.length > 0 ) {
				var target = intersects[ 0 ];

				// TODO: Loop over intersections (only does one)
				var intersectDistance = target.distance;
				if ( intersectDistance <= this.traits.size ) {
					// collision
					if (
						this.traits.color === target.object.traits.color &&
						this.traits.gender !== target.object.traits.gender &&
						this.traits.gender === 'female'
					) {
						this.ecosystem.spawnCell( { 'position' : new THREE.Vector3().copy( this.position ), 'traits' : { 'color' : this.traits.color } } );
					}

					this._setColor( 0xFF0000 );
				} else {
					// in sight
				}
			}
		}
	};

	return Cell;
} );